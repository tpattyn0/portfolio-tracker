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

import { FundamentalAnalysisService, SCORING_VERSION } from "./fundamental-analysis.service";

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

/**
 * TD-11 (plans/2026-07-23-lib-cleanup-batch.md): cache freshness is gated by
 * SCORING_VERSION (persisted in scoreDetails.scoringVersion) ANDed with the
 * pre-existing 24h `lastUpdated` recency check. The two gates must stay
 * independent.
 */
describe("FundamentalAnalysisService.fetchFundamentals (SCORING_VERSION cache gate)", () => {
  let service: FundamentalAnalysisService;

  function makeCachedRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      symbol: "AAPL",
      lastUpdated: new Date(), // within 24h by default
      data: null,
      peRatio: 20,
      forwardPE: null,
      pegRatio: null,
      psRatio: null,
      pbRatio: null,
      pfcfRatio: null,
      evToEbitda: null,
      enterpriseValue: null,
      marketCap: 2_000_000_000,
      eps: null,
      forwardEps: null,
      bookValue: null,
      profitMargin: null,
      operatingMargin: null,
      roe: null,
      roa: null,
      roic: null,
      revenueGrowth: null,
      earningsGrowth: null,
      fcfGrowth: null,
      currentRatio: null,
      quickRatio: null,
      debtToEquity: null,
      interestCoverage: null,
      dividendYield: null,
      payoutRatio: null,
      dividendGrowth: null,
      scoreDetails: {
        total: 7,
        breakdown: { valuation: 7, profitability: 7, growth: 7, financial: 7, dividend: 7 },
        interpretation: "cached",
        scoringVersion: SCORING_VERSION,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockResolvedValue({});
    service = new FundamentalAnalysisService();
    // Fresh-fetch fallback data, used only by the test cases that expect a
    // refetch to occur.
    safeQuoteSummaryMock.mockResolvedValue({
      price: { regularMarketPrice: 150, marketCap: 3_000_000_000 },
      summaryDetail: { trailingPE: 25 },
    });
  });

  it("(happy) serves from cache with no safeQuoteSummary call when scoringVersion matches and lastUpdated is within 24h", async () => {
    findUniqueMock.mockResolvedValue(makeCachedRow());

    const result = await service.fetchFundamentals("AAPL");

    expect(safeQuoteSummaryMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result.score.total).toBe(7);
  });

  it("(staleness) triggers a fresh fetch when scoringVersion is missing, even though lastUpdated is within 24h", async () => {
    const row = makeCachedRow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (row.scoreDetails as any).scoringVersion;
    findUniqueMock.mockResolvedValue(row);

    await service.fetchFundamentals("AAPL");

    expect(safeQuoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("(staleness) triggers a fresh fetch when scoringVersion is lower than SCORING_VERSION, even though lastUpdated is within 24h", async () => {
    findUniqueMock.mockResolvedValue(
      makeCachedRow({
        scoreDetails: {
          total: 7,
          breakdown: { valuation: 7, profitability: 7, growth: 7, financial: 7, dividend: 7 },
          interpretation: "cached",
          scoringVersion: SCORING_VERSION - 1,
        },
      })
    );

    await service.fetchFundamentals("AAPL");

    expect(safeQuoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("(regression) still refetches when scoringVersion matches but lastUpdated is older than 24h — the two gates stay independent", async () => {
    findUniqueMock.mockResolvedValue(
      makeCachedRow({
        lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      })
    );

    await service.fetchFundamentals("AAPL");

    expect(safeQuoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
