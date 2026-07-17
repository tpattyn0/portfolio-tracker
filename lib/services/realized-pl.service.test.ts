import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { matchFifoLots, calculateRealizedPL, type Lot } from "./realized-pl.service";

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
