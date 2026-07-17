import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  matchFifoLots,
  calculateRealizedPL,
  resolveCostBasisWithFallback,
  type Lot,
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
