import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan (plans/2026-07-18-yahoo-validation-error.md) Task 3: getQuote routes
 * through safeQuoteSummary. A coerced result with a valid `price` module
 * still returns a well-formed MarketQuote; a `price`-less result still
 * throws "No price data available" — confirming the pre-existing guard
 * fires against the wrapper's return, same as before. No live Yahoo network
 * calls — @/lib/yahoo-finance is mocked.
 */

const { safeQuoteSummaryMock } = vi.hoisted(() => ({
  safeQuoteSummaryMock: vi.fn(),
}));

vi.mock("@/lib/yahoo-finance", () => ({
  default: {
    chart: vi.fn(),
    search: vi.fn(),
  },
  safeQuoteSummary: safeQuoteSummaryMock,
}));

import { MarketDataService } from "./market-data.service";

describe("MarketDataService.getQuote (Yahoo validation resilience)", () => {
  let service: MarketDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MarketDataService();
  });

  it("returns a well-formed MarketQuote when safeQuoteSummary's coerced result has a valid price module", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      price: {
        symbol: "AAPL",
        longName: "Apple Inc.",
        regularMarketPrice: 150,
        regularMarketChange: 1.5,
        regularMarketChangePercent: 1.01,
        regularMarketDayHigh: 151,
        regularMarketDayLow: 148,
        regularMarketOpen: 149,
        regularMarketPreviousClose: 148.5,
        regularMarketVolume: 1_000_000,
        marketCap: 2_000_000_000,
        currency: "USD",
        exchange: "NMS",
      },
      summaryDetail: {
        fiftyTwoWeekHigh: 200,
        fiftyTwoWeekLow: 100,
      },
    });

    const quote = await service.getQuote("AAPL");

    expect(quote.symbol).toBe("AAPL");
    expect(quote.price).toBe(150);
    expect(quote.yearHigh).toBe(200);
  });

  it("throws when the coerced result has no price module", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      summaryDetail: { fiftyTwoWeekHigh: 200 },
    });

    await expect(service.getQuote("AAPL")).rejects.toThrow(
      /Failed to fetch market data for AAPL/
    );
  });
});
