import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Parity test for plan Task 4 (2026-07-18-performance-audit-remediation):
 * the dashboard day-change calculation used to fire one uncached
 * `getHistoricalRange(...,'1d')` Yahoo call per position to derive
 * yesterday's close. It now uses `previousClose` from the already-fetched
 * quote. This test fixes a single-position fixture and asserts the new
 * dayChange/dayChangePercent match what the old historical-range-based
 * math would have produced for the same yesterday's-close value — i.e. the
 * *data source* changed, not the *formula* (AGENT.md: a wrong number here
 * is silent).
 */

const PORTFOLIO_ID = "portfolio-1";

function makePosition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "position-1",
    portfolioId: PORTFOLIO_ID,
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: new Decimal(10),
    avgCostBasis: new Decimal(150),
    currentPrice: new Decimal(250),
    marketValue: new Decimal(2500),
    unrealizedPL: new Decimal(1000),
    unrealizedPLPercent: new Decimal(66.67),
    firstBuyDate: new Date("2026-01-01"),
    lastActivity: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const YESTERDAY_CLOSE = 240; // fixed fixture value, used by both "old" and "new" math below

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ userId: "user-1" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolio: {
      findUnique: vi.fn(async () => ({
        id: PORTFOLIO_ID,
        userId: "user-1",
        baseCurrency: "USD",
        positions: [makePosition()],
        transactions: [],
      })),
    },
  },
}));

vi.mock("@/lib/services/exchange-rate.service", () => ({
  exchangeRateService: {
    getRate: vi.fn(async () => 1),
  },
}));

vi.mock("@/lib/services/market-data.service", () => ({
  marketDataService: {
    getQuote: vi.fn(async () => ({
      previousClose: YESTERDAY_CLOSE,
    })),
    // Present so a regression that reintroduces the per-position historical
    // fanout is caught by the "not called" assertion below, rather than by
    // a missing-mock crash.
    getHistoricalRange: vi.fn(),
  },
}));

import { GET } from "./route";
import { marketDataService } from "@/lib/services/market-data.service";

describe("GET /api/portfolio day-change (plan Task 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (marketDataService.getQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      previousClose: YESTERDAY_CLOSE,
    });
  });

  it("computes dayChange/dayChangePercent from previousClose, matching the old historical-range-based formula", async () => {
    const req = new NextRequest("http://localhost/api/portfolio");
    const res = await GET(req);
    const body = await res.json();

    const quantity = 10;
    const totalValue = 2500; // marketValue from the fixture, base currency = position currency (rate 1)

    // The "old" formula (pre-Task-4): yesterdayValue = quantity * yesterdayClose * rate,
    // then dayChange = totalValue - totalYesterdayValue, dayChangePercent = dayChange / totalYesterdayValue * 100.
    const expectedYesterdayValue = quantity * YESTERDAY_CLOSE * 1;
    const expectedDayChange = totalValue - expectedYesterdayValue;
    const expectedDayChangePercent = (expectedDayChange / expectedYesterdayValue) * 100;

    expect(body.dayChange).toBeCloseTo(expectedDayChange, 6);
    expect(body.dayChangePercent).toBeCloseTo(expectedDayChangePercent, 6);
  });

  it("derives yesterday's close from the quote, not a per-position historical-range call", async () => {
    const req = new NextRequest("http://localhost/api/portfolio");
    await GET(req);

    expect(marketDataService.getQuote).toHaveBeenCalledWith("AAPL");
    expect(marketDataService.getHistoricalRange).not.toHaveBeenCalled();
  });

  it("falls back to current value (zero day-change) when previousClose is unavailable", async () => {
    (marketDataService.getQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      previousClose: 0,
    });

    const req = new NextRequest("http://localhost/api/portfolio");
    const res = await GET(req);
    const body = await res.json();

    expect(body.dayChange).toBe(0);
    expect(body.dayChangePercent).toBe(0);
  });
});
