import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Regression test for PT-I1 (reviews/2026-07-19-positions-tab.md): the GET
 * position route previously hardcoded `realizedPL: 0` with a comment
 * claiming the field wasn't implemented in the schema. `Position` genuinely
 * has no persisted per-position `realizedPL` column, so this drives the real
 * route handler through positions with BUY/SELL transaction history and
 * asserts the computed realized P/L matches what closed-positions-style FIFO
 * matching would produce — for both a partially-sold (held) and a
 * fully-sold (closed) position.
 */

const PORTFOLIO_ID = "portfolio-1";

function makePosition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "position-1",
    portfolioId: PORTFOLIO_ID,
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "EUR",
    quantity: new Decimal(10),
    avgCostBasis: new Decimal(100),
    currentPrice: new Decimal(150),
    marketValue: new Decimal(1500),
    unrealizedPL: new Decimal(500),
    unrealizedPLPercent: new Decimal(50),
    firstBuyDate: new Date("2026-01-01"),
    lastActivity: new Date("2026-01-01"),
    transactions: [] as Array<Record<string, unknown>>,
    ...overrides,
  };
}

function tx(
  type: "BUY" | "SELL",
  quantity: number,
  price: number,
  fees: number,
  executedAt: string
) {
  return {
    id: `tx-${type}-${executedAt}`,
    type,
    ticker: "AAPL",
    quantity: new Decimal(quantity),
    price: new Decimal(price),
    fees: new Decimal(fees),
    totalAmount: new Decimal(quantity).mul(price),
    executedAt: new Date(executedAt),
  };
}

let portfolioState: { id: string; baseCurrency: string };
let positionState: ReturnType<typeof makePosition> | null;

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUserWithPortfolio: vi.fn(async () => ({
    portfolio: portfolioState,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    position: {
      findUnique: vi.fn(async () => positionState),
    },
  },
}));

vi.mock("@/lib/services/exchange-rate.service", () => ({
  exchangeRateService: {
    getRate: vi.fn(async () => 1),
  },
}));

function getRequest() {
  return new NextRequest("http://localhost/api/portfolio/positions/AAPL");
}

describe("GET /api/portfolio/positions/[ticker] — realized P/L (PT-I1)", () => {
  beforeEach(() => {
    portfolioState = { id: PORTFOLIO_ID, baseCurrency: "EUR" };
  });

  it("computes realized P/L for a held (partially-sold) position from its transaction history", async () => {
    positionState = makePosition({
      quantity: new Decimal(10), // 20 bought, 10 sold, 10 remain
      transactions: [
        tx("BUY", 20, 100, 0, "2026-01-01"),
        tx("SELL", 10, 150, 0, "2026-03-01"),
      ],
    });

    const { GET } = await import("./route");
    const res = await GET(getRequest(), { params: Promise.resolve({ ticker: "AAPL" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    // cost basis 10*100=1000, proceeds 10*150=1500 -> realized 500
    expect(body.realizedPL).toBe(500);
    expect(body.quantity).toBe(10);
  });

  it("computes realized P/L for a closed (fully-sold) position — the state where it matters most", async () => {
    positionState = makePosition({
      quantity: new Decimal(0),
      transactions: [
        tx("BUY", 10, 100, 0, "2026-01-01"),
        tx("SELL", 10, 80, 0, "2026-02-01"), // sold at a loss
      ],
    });

    const { GET } = await import("./route");
    const res = await GET(getRequest(), { params: Promise.resolve({ ticker: "AAPL" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    // cost basis 10*100=1000, proceeds 10*80=800 -> realized -200
    expect(body.realizedPL).toBe(-200);
    expect(body.quantity).toBe(0);
  });

  it("returns 0 realized P/L when the position has no SELL transactions", async () => {
    positionState = makePosition({
      quantity: new Decimal(10),
      transactions: [tx("BUY", 10, 100, 0, "2026-01-01")],
    });

    const { GET } = await import("./route");
    const res = await GET(getRequest(), { params: Promise.resolve({ ticker: "AAPL" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.realizedPL).toBe(0);
  });

  it("returns 404 when no position record exists", async () => {
    positionState = null;

    const { GET } = await import("./route");
    const res = await GET(getRequest(), { params: Promise.resolve({ ticker: "AAPL" }) });

    expect(res.status).toBe(404);
  });
});
