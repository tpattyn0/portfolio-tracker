import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Regression test for AUD-FIX-01: the sell route previously matched each new
 * sell against undepleted BUY lots, ignoring quantity already consumed by
 * prior sells on the same position. This drives the real route handler
 * (not a simulation) through two sequential sells against a two-lot position
 * and asserts the accumulated `portfolio.realizedPL` matches what
 * closed-positions-style cumulative FIFO would produce.
 */

const PORTFOLIO_ID = "portfolio-1";
const POSITION_ID = "position-1";

function makePosition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: POSITION_ID,
    portfolioId: PORTFOLIO_ID,
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: new Decimal(20),
    avgCostBasis: new Decimal(150),
    currentPrice: new Decimal(250),
    marketValue: new Decimal(5000),
    unrealizedPL: new Decimal(2000),
    unrealizedPLPercent: new Decimal(66.67),
    firstBuyDate: new Date("2026-01-01"),
    lastActivity: new Date("2026-01-01"),
    ...overrides,
  };
}

// Mutable in-memory state the mocked prisma reads/writes, so the second call
// in a test sees the first sell's persisted SELL transaction and updated
// portfolio.realizedPL — exercising the real accumulation path.
let portfolioState: { id: string; realizedPL: Decimal };
let positionState: ReturnType<typeof makePosition>;
let sellTransactions: Array<{ quantity: Decimal; executedAt: Date }>;
const buyTransactions = [
  { quantity: new Decimal(10), price: new Decimal(100), fees: new Decimal(0), executedAt: new Date("2026-01-01") },
  { quantity: new Decimal(10), price: new Decimal(200), fees: new Decimal(0), executedAt: new Date("2026-02-01") },
];

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUserWithPortfolio: vi.fn(async () => ({
    userId: "user-1",
    portfolio: portfolioState,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    position: {
      findUnique: vi.fn(async () => positionState),
      update: vi.fn(async ({ data }) => {
        Object.assign(positionState, data);
        return positionState;
      }),
      findMany: vi.fn(async () => [positionState]),
    },
    transaction: {
      findMany: vi.fn(async ({ where }: { where: { type: string } }) => {
        if (where.type === "BUY") return buyTransactions;
        if (where.type === "SELL") return sellTransactions;
        return [];
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `txn-${sellTransactions.length + 1}`, ...data };
        sellTransactions.push({
          quantity: data.quantity as Decimal,
          executedAt: data.executedAt as Date,
        });
        return created;
      }),
    },
    portfolio: {
      update: vi.fn(async ({ data }) => {
        Object.assign(portfolioState, data);
        return portfolioState;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import("@/lib/prisma");
      return callback(prisma);
    }),
  },
}));

function sellRequest(quantity: number, date: string) {
  return new NextRequest("http://localhost/api/portfolio/positions/AAPL/sell", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quantity, price: 250, date, fees: 0 }),
  });
}

describe("POST /api/portfolio/positions/[ticker]/sell — FIFO depletion across sells (AUD-FIX-01)", () => {
  beforeEach(() => {
    portfolioState = { id: PORTFOLIO_ID, realizedPL: new Decimal(0) };
    positionState = makePosition();
    sellTransactions = [];
  });

  it("matches a second sell against the second (later) lot, not the already-consumed first lot", async () => {
    const { POST } = await import("./route");

    // First sell: 10 shares. Should match lot 1 (10 @ $100) -> cost basis $1000.
    const res1 = await POST(sellRequest(10, "2026-03-01"), {
      params: Promise.resolve({ ticker: "AAPL" }),
    });
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    // proceeds 10*250=2500, cost 1000 -> PL 1500
    expect(body1.realizedPL).toBe(1500);

    // Second sell: 10 shares. Lot 1 is now depleted — must match lot 2 (10 @ $200) -> cost basis $2000.
    positionState.quantity = new Decimal(10); // remaining after first sell
    const res2 = await POST(sellRequest(10, "2026-03-02"), {
      params: Promise.resolve({ ticker: "AAPL" }),
    });
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    // proceeds 10*250=2500, cost 2000 -> PL 500 (NOT 1500, which would mean lot 1 was reused)
    expect(body2.realizedPL).toBe(500);

    // Accumulated portfolio.realizedPL must equal the sum closed-positions would report: 1500 + 500 = 2000.
    expect(portfolioState.realizedPL.toNumber()).toBe(2000);
  });
});
