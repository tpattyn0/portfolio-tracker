import { describe, it, expect, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { applyBuyToPosition, recalculatePortfolioTotals } from "./position.service";
import type { Position } from "@prisma/client";

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos-1",
    portfolioId: "portfolio-1",
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: new Decimal(10),
    avgCostBasis: new Decimal(100),
    currentPrice: new Decimal(120),
    marketValue: new Decimal(1200),
    unrealizedPL: new Decimal(200),
    unrealizedPLPercent: new Decimal(20),
    firstBuyDate: new Date("2026-01-01"),
    lastActivity: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Position;
}

function makeTx() {
  return {
    transaction: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: "txn-1", ...data })
      ),
    },
    position: {
      update: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn(),
    },
    portfolio: {
      update: vi.fn().mockResolvedValue(undefined),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("applyBuyToPosition (AUD-02)", () => {
  it("recomputes average cost basis, market value against currentPrice, and recalculates portfolio totals", async () => {
    const tx = makeTx();
    const position = makePosition();
    tx.position.findMany.mockResolvedValue([
      makePosition({
        // simulate the post-update position state the recalculation would read
        quantity: new Decimal(15),
        avgCostBasis: new Decimal(103.33),
        marketValue: new Decimal(1800),
        unrealizedPL: new Decimal(250.05),
      }),
    ]);

    const result = await applyBuyToPosition({
      tx,
      portfolioId: "portfolio-1",
      position,
      ticker: "AAPL",
      name: "Apple Inc.",
      quantity: 5,
      price: 110,
      fees: 5,
      date: new Date("2026-02-01"),
    });

    // (10 * 100 + (5*110 + 5)) / 15 = (1000 + 555) / 15 = 103.6666...
    expect(result.newAvgCostBasis.toDecimalPlaces(4).toNumber()).toBeCloseTo(103.6667, 3);
    expect(result.newTotalQuantity.toNumber()).toBe(15);

    // Market value must be computed against currentPrice, not purchase price (AUD-02 bug).
    expect(tx.position.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          marketValue: expect.any(Decimal),
        }),
      })
    );
    const updateCall = tx.position.update.mock.calls[0][0];
    expect(updateCall.data.marketValue.toNumber()).toBe(15 * 120); // 15 shares * currentPrice(120)
    expect(updateCall.data.unrealizedPL.equals(new Decimal(0))).toBe(false);

    // Operation must be wrapped by the caller's transaction and recalc totals.
    expect(tx.portfolio.update).toHaveBeenCalledTimes(1);
    expect(tx.portfolio.update.mock.calls[0][0].data).toHaveProperty("totalValue");
    expect(tx.portfolio.update.mock.calls[0][0].data).toHaveProperty("totalCost");
    expect(tx.portfolio.update.mock.calls[0][0].data).toHaveProperty("unrealizedPL");
  });

  it("creates a BUY transaction record with the correct totalAmount", async () => {
    const tx = makeTx();
    tx.position.findMany.mockResolvedValue([]);
    const position = makePosition();

    const result = await applyBuyToPosition({
      tx,
      portfolioId: "portfolio-1",
      position,
      ticker: "AAPL",
      name: "Apple Inc.",
      quantity: 2,
      price: 50,
      fees: 1,
      date: new Date("2026-02-01"),
    });

    expect(result.transaction.type).toBe("BUY");
    expect(result.transaction.totalAmount.toNumber()).toBe(101); // 2*50 + 1
  });
});

describe("recalculatePortfolioTotals", () => {
  it("sums marketValue/cost/unrealizedPL across all positions", async () => {
    const tx = makeTx();
    tx.position.findMany.mockResolvedValue([
      makePosition({ marketValue: new Decimal(1000), quantity: new Decimal(10), avgCostBasis: new Decimal(80), unrealizedPL: new Decimal(200) }),
      makePosition({ marketValue: new Decimal(500), quantity: new Decimal(5), avgCostBasis: new Decimal(90), unrealizedPL: new Decimal(50) }),
    ]);

    await recalculatePortfolioTotals(tx, "portfolio-1");

    const data = tx.portfolio.update.mock.calls[0][0].data;
    expect(data.totalValue.toNumber()).toBe(1500);
    expect(data.totalCost.toNumber()).toBe(10 * 80 + 5 * 90);
    expect(data.unrealizedPL.toNumber()).toBe(250);
  });

  it("handles an empty portfolio without throwing", async () => {
    const tx = makeTx();
    tx.position.findMany.mockResolvedValue([]);

    await recalculatePortfolioTotals(tx, "portfolio-1");

    const data = tx.portfolio.update.mock.calls[0][0].data;
    expect(data.totalValue.toNumber()).toBe(0);
    expect(data.totalCost.toNumber()).toBe(0);
    expect(data.unrealizedPL.toNumber()).toBe(0);
  });
});
