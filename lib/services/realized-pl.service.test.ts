import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  matchFifoLots,
  calculateRealizedPL,
  resolveCostBasisWithFallback,
  computePositionRealizedPL,
  type Lot,
  type TransactionForRealizedPL,
} from "./realized-pl.service";

function lot(quantity: number, price: number, fees: number, date: string): Lot {
  return {
    quantity: new Decimal(quantity),
    price: new Decimal(price),
    fees: new Decimal(fees),
    date: new Date(date),
  };
}

describe("matchFifoLots", () => {
  it("matches a sell fully against a single buy lot, prorating fees", () => {
    const lots = [lot(10, 100, 10, "2026-01-01")]; // $10 fee / 10 shares = $1/share
    const result = matchFifoLots(lots, new Decimal(5));

    // 5 shares * $100 + 5 shares * $1 fee/share = $505
    expect(result.totalBuyCost.toNumber()).toBe(505);
    expect(result.unmatchedQuantity.toNumber()).toBe(0);
    expect(result.firstBuyDate).toEqual(new Date("2026-01-01"));
    // Lot mutated in place — 5 shares remain
    expect(lots[0].quantity.toNumber()).toBe(5);
  });

  it("consumes oldest lots first across multiple buys (FIFO)", () => {
    const lots = [
      lot(5, 100, 0, "2026-01-01"),
      lot(5, 200, 0, "2026-02-01"),
    ];
    const result = matchFifoLots(lots, new Decimal(8));

    // 5 shares @ 100 + 3 shares @ 200 = 500 + 600 = 1100
    expect(result.totalBuyCost.toNumber()).toBe(1100);
    expect(result.unmatchedQuantity.toNumber()).toBe(0);
    expect(lots[0].quantity.toNumber()).toBe(0);
    expect(lots[1].quantity.toNumber()).toBe(2);
  });

  it("reports unmatchedQuantity instead of silently dropping the sell when lots run out (AUD-04)", () => {
    const lots = [lot(3, 100, 0, "2026-01-01")];
    const result = matchFifoLots(lots, new Decimal(5));

    expect(result.unmatchedQuantity.toNumber()).toBe(2);
    expect(result.totalBuyCost.toNumber()).toBe(300);
  });

  it("skips exhausted lots (quantity <= 0)", () => {
    const lots = [lot(0, 100, 0, "2026-01-01"), lot(4, 150, 0, "2026-01-02")];
    const result = matchFifoLots(lots, new Decimal(4));

    expect(result.totalBuyCost.toNumber()).toBe(600);
    expect(result.unmatchedQuantity.toNumber()).toBe(0);
  });
});

describe("calculateRealizedPL", () => {
  it("computes realized P/L including sell fees (happy path)", () => {
    const result = calculateRealizedPL(
      new Decimal(10),
      new Decimal(150),
      new Decimal(5),
      new Decimal(1000)
    );

    // (10 * 150 - 5) - 1000 = 1495 - 1000 = 495
    expect(result.realizedPL.toNumber()).toBe(495);
    expect(result.realizedPLPercent.toNumber()).toBe(49.5);
  });

  it("returns 0% (not NaN/Infinity) when cost basis is zero", () => {
    const result = calculateRealizedPL(
      new Decimal(10),
      new Decimal(150),
      new Decimal(0),
      new Decimal(0)
    );

    expect(result.realizedPLPercent.toNumber()).toBe(0);
    expect(result.realizedPL.toNumber()).toBe(1500);
  });

  it("computes a negative realized P/L for a loss", () => {
    const result = calculateRealizedPL(
      new Decimal(10),
      new Decimal(50),
      new Decimal(2),
      new Decimal(1000)
    );

    // (10 * 50 - 2) - 1000 = 498 - 1000 = -502
    expect(result.realizedPL.toNumber()).toBe(-502);
  });
});

describe("resolveCostBasisWithFallback (AUD-FIX-03)", () => {
  it("returns the matched FIFO cost as-is when everything matched", () => {
    const lots = [lot(10, 100, 0, "2026-01-01")];
    const matchResult = matchFifoLots(lots, new Decimal(10));

    const { totalCostBasis, unmatchedQuantity } = resolveCostBasisWithFallback(
      matchResult,
      new Decimal(999), // avgCostBasis should be irrelevant here
      "test"
    );

    expect(totalCostBasis.toNumber()).toBe(1000);
    expect(unmatchedQuantity.toNumber()).toBe(0);
  });

  it("covers the unmatched remainder at average cost basis", () => {
    const lots = [lot(3, 100, 0, "2026-01-01")];
    const matchResult = matchFifoLots(lots, new Decimal(5));

    const { totalCostBasis, unmatchedQuantity } = resolveCostBasisWithFallback(
      matchResult,
      new Decimal(150),
      "test"
    );

    // matched: 3 * 100 = 300; fallback: 2 * 150 = 300; total = 600
    expect(unmatchedQuantity.toNumber()).toBe(2);
    expect(totalCostBasis.toNumber()).toBe(600);
  });
});

describe("sell route vs closed-positions reconciliation (AUD-FIX-01)", () => {
  // Regression test for AUD-FIX-01: the sell route previously matched each new
  // sell against *undepleted* BUY lots, ignoring quantity already consumed by
  // prior sells on the same position — while closed-positions correctly
  // depletes lots cumulatively across all sells in chronological order. This
  // simulates both code paths against the same transaction history and
  // asserts they agree, the way the sell route and closed-positions route
  // must agree on `portfolio.realizedPL` vs "Total realized P/L".

  function buildBuyLots(): Lot[] {
    return [lot(10, 100, 0, "2026-01-01"), lot(10, 200, 0, "2026-02-01")];
  }

  /** Simulates closed-positions: one array of lots, depleted cumulatively across all sells. */
  function closedPositionsTotal(sellQuantities: number[]): Decimal {
    const lots = buildBuyLots();
    let total = new Decimal(0);
    for (const qty of sellQuantities) {
      const matchResult = matchFifoLots(lots, new Decimal(qty));
      const { totalCostBasis } = resolveCostBasisWithFallback(matchResult, new Decimal(150), "test");
      const { realizedPL } = calculateRealizedPL(new Decimal(qty), new Decimal(250), new Decimal(0), totalCostBasis);
      total = total.plus(realizedPL);
    }
    return total;
  }

  /** Simulates the FIXED sell route: for each sell, first replay all prior
   * sells against a fresh lot array to advance the FIFO cursor, then match
   * the current sell — mirroring app/api/portfolio/positions/[ticker]/sell/route.ts. */
  function sellRouteTotal(sellQuantities: number[]): Decimal {
    let total = new Decimal(0);
    for (let i = 0; i < sellQuantities.length; i++) {
      const lots = buildBuyLots();
      for (let j = 0; j < i; j++) {
        matchFifoLots(lots, new Decimal(sellQuantities[j]));
      }
      const matchResult = matchFifoLots(lots, new Decimal(sellQuantities[i]));
      const { totalCostBasis } = resolveCostBasisWithFallback(matchResult, new Decimal(150), "test");
      const { realizedPL } = calculateRealizedPL(
        new Decimal(sellQuantities[i]),
        new Decimal(250),
        new Decimal(0),
        totalCostBasis
      );
      total = total.plus(realizedPL);
    }
    return total;
  }

  it("agrees with closed-positions for a single sell against a multi-lot position", () => {
    const sells = [10];
    expect(sellRouteTotal(sells).toNumber()).toBe(closedPositionsTotal(sells).toNumber());
  });

  it("agrees with closed-positions for a second sell consuming a later lot", () => {
    // BUY 10@100, BUY 10@200; SELL 10 (matches lot1), SELL 10 (must match lot2, not lot1 again).
    const sells = [10, 10];

    const closed = closedPositionsTotal(sells);
    const sellRoute = sellRouteTotal(sells);

    expect(sellRoute.toNumber()).toBe(closed.toNumber());

    // Pin the actual expected numbers so a future regression is caught even if
    // both simulations were wrong in the same way:
    // sell 1: cost 10*100=1000, proceeds 10*250=2500, PL=1500
    // sell 2: cost 10*200=2000, proceeds 10*250=2500, PL=500
    expect(closed.toNumber()).toBe(2000);
  });

  it("agrees with closed-positions across three sells spanning both lots and an unmatched remainder", () => {
    const sells = [5, 10, 10]; // 25 total against 20 available -> last sell partially unmatched
    expect(sellRouteTotal(sells).toNumber()).toBe(closedPositionsTotal(sells).toNumber());
  });
});

describe("computePositionRealizedPL (PT-I2 — direct coverage of the composed function)", () => {
  // GET /api/portfolio/positions/[ticker]/route.test.ts already drives this
  // function end-to-end through the route handler (held/closed/no-sells/404),
  // but only with single-buy-lot inputs. These cases assert the function
  // directly and cover the multi-lot FIFO-ordering and fallback paths that
  // the route tests don't exercise (PT-I2, reviews/2026-07-19-positions-tab.md).

  function tx(
    type: "BUY" | "SELL",
    quantity: number,
    price: number,
    fees: number,
    executedAt: string
  ): TransactionForRealizedPL {
    return {
      type,
      quantity: new Decimal(quantity),
      price: new Decimal(price),
      fees: new Decimal(fees),
      executedAt: new Date(executedAt),
    };
  }

  it("returns 0 when the position has no SELL transactions", () => {
    const transactions = [tx("BUY", 10, 100, 0, "2026-01-01")];

    const result = computePositionRealizedPL(transactions, new Decimal(100));

    expect(result.toNumber()).toBe(0);
  });

  it("computes a gain for a partial sell against a single buy lot", () => {
    // 20 bought @100, 10 sold @150 -> 10 remain held.
    const transactions = [
      tx("BUY", 20, 100, 0, "2026-01-01"),
      tx("SELL", 10, 150, 0, "2026-03-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(100));

    // cost basis 10*100=1000, proceeds 10*150=1500 -> realized +500
    expect(result.toNumber()).toBe(500);
  });

  it("computes a loss for a partial sell against a single buy lot", () => {
    const transactions = [
      tx("BUY", 20, 100, 0, "2026-01-01"),
      tx("SELL", 10, 80, 0, "2026-03-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(100));

    // cost basis 10*100=1000, proceeds 10*80=800 -> realized -200
    expect(result.toNumber()).toBe(-200);
  });

  it("computes realized P/L for a full sell that closes the position", () => {
    const transactions = [
      tx("BUY", 10, 100, 0, "2026-01-01"),
      tx("SELL", 10, 150, 0, "2026-02-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(100));

    // cost basis 10*100=1000, proceeds 10*150=1500 -> realized +500
    expect(result.toNumber()).toBe(500);
  });

  it("depletes multiple buy lots FIFO (oldest first) when a sell spans both", () => {
    // BUY 10@100 (Jan), BUY 10@200 (Feb); SELL 15@250 (Mar) must consume the
    // full Jan lot before touching the Feb lot: 10@100 + 5@200 = 2000 cost.
    const transactions = [
      tx("BUY", 10, 100, 0, "2026-01-01"),
      tx("BUY", 10, 200, 0, "2026-02-01"),
      tx("SELL", 15, 250, 0, "2026-03-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(150));

    // proceeds 15*250=3750, cost basis 2000 -> realized +1750
    expect(result.toNumber()).toBe(1750);
  });

  it("prorates buy fees into cost basis and subtracts sell fees from proceeds", () => {
    // BUY 10@100 with $20 total fee ($2/share); SELL 10@150 with $15 sell fee.
    const transactions = [
      tx("BUY", 10, 100, 20, "2026-01-01"),
      tx("SELL", 10, 150, 15, "2026-02-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(100));

    // cost basis = 10*100 + 10*2 = 1020; proceeds = 10*150 - 15 = 1485
    // realized = 1485 - 1020 = 465 (differs from the no-fee 500, proving fees are applied)
    expect(result.toNumber()).toBe(465);
  });

  it("falls back to avgCostBasis for the unmatched remainder when a sell exceeds recorded buy lots", () => {
    // Only 5 shares were ever bought, but the sell is for 8 — a data
    // inconsistency resolveCostBasisWithFallback covers with avgCostBasis
    // rather than silently dropping value.
    const transactions = [
      tx("BUY", 5, 100, 0, "2026-01-01"),
      tx("SELL", 8, 120, 0, "2026-02-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(110));

    // matched: 5*100=500; fallback: 3*110=330; total cost basis=830
    // proceeds: 8*120=960 -> realized = 960 - 830 = 130
    expect(result.toNumber()).toBe(130);
  });

  it("sums realized P/L across multiple sells, each depleting lots cumulatively", () => {
    // BUY 10@100 (Jan), BUY 10@200 (Feb); SELL 10@250 (Mar) consumes lot1;
    // SELL 10@250 (Apr) must consume lot2, not re-match lot1.
    const transactions = [
      tx("BUY", 10, 100, 0, "2026-01-01"),
      tx("BUY", 10, 200, 0, "2026-02-01"),
      tx("SELL", 10, 250, 0, "2026-03-01"),
      tx("SELL", 10, 250, 0, "2026-04-01"),
    ];

    const result = computePositionRealizedPL(transactions, new Decimal(150));

    // sell1: cost 1000, proceeds 2500 -> PL 1500
    // sell2: cost 2000, proceeds 2500 -> PL 500
    // total = 2000
    expect(result.toNumber()).toBe(2000);
  });
});
