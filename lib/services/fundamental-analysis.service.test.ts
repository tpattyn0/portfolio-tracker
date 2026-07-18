import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan (plans/2026-07-18-yahoo-validation-error.md) Task 2: fetchFundamentals
 * routes through safeQuoteSummary. A validation-error result with a populated
 * `price` module still yields usable metrics (coerced-partial path); a result
 * with neither `price` nor `summaryDetail` throws before extraction/persist so
 * an all-null row is never saved or cached (fail-loud guard). No live Yahoo
 * network calls — @/lib/yahoo-finance and @/lib/prisma are mocked.
 */

const { safeQuoteSummaryMock, findUniqueMock, upsertMock } = vi.hoisted(() => ({
  safeQuoteSummaryMock: vi.fn(),
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/yahoo-finance", () => ({
  default: {},
  safeQuoteSummary: safeQuoteSummaryMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fundamentalData: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

import { FundamentalAnalysisService } from "./fundamental-analysis.service";

describe("FundamentalAnalysisService.fetchFundamentals (Yahoo validation resilience)", () => {
  let service: FundamentalAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue(null); // no cache — always fetch fresh
    upsertMock.mockResolvedValue({});
    service = new FundamentalAnalysisService();
  });

  it("returns usable metrics when safeQuoteSummary's coerced result has a populated price module", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      price: { regularMarketPrice: 150, marketCap: 2_000_000_000 },
      summaryDetail: { trailingPE: 20 },
    });

    const result = await service.fetchFundamentals("AAPL");

    expect(result.valuation.marketCap).toBe(2_000_000_000);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("throws and does not call saveToDatabase when the result has neither price nor summaryDetail", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      defaultKeyStatistics: { trailingEps: 5 },
    });

    await expect(service.fetchFundamentals("AAPL")).rejects.toThrow(
      /No usable fundamentals data/
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
