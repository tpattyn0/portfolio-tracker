import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan (plans/2026-07-18-yahoo-validation-error.md) Task 4: fetchAnalystRatings
 * routes through safeQuoteSummary with NO added hard module guard — a missing
 * `recommendationTrend` in the coerced result legitimately means "no analyst
 * coverage" and must resolve to the existing neutral path (totalAnalysts: 0,
 * neutral score), not a throw. No live Yahoo network calls — @/lib/yahoo-finance
 * and @/lib/prisma are mocked.
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
    analystRating: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

import { AnalystRatingsService } from "./analyst-ratings.service";

describe("AnalystRatingsService.fetchAnalystRatings (Yahoo validation resilience)", () => {
  let service: AnalystRatingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue(null); // no cache — always fetch fresh
    upsertMock.mockResolvedValue({});
    service = new AnalystRatingsService();
  });

  it("returns totalAnalysts: 0 and a neutral score when the coerced result has no recommendationTrend module", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175 },
      // recommendationTrend intentionally absent — simulates Yahoo drift
      // coercing that module away, which is a valid "no coverage" state.
    });

    const result = await service.fetchAnalystRatings("AAPL");

    expect(result.totalAnalysts).toBe(0);
    expect(result.score).toBe(5);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("returns populated ratings when the coerced result has a valid recommendationTrend module", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175 },
      recommendationTrend: {
        trend: [{ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 }],
      },
    });

    const result = await service.fetchAnalystRatings("AAPL");

    expect(result.totalAnalysts).toBe(10);
    expect(result.score).toBeGreaterThan(5);
  });
});

/**
 * plans/2026-07-19-research-tab-fixes.md Task 2/3: targetLowPrice/
 * targetHighPrice and analyst revisions are plumbed from Yahoo's
 * financialData/upgradeDowngradeHistory modules (already fetched) through
 * the extractor into the response. Non-persisted (OD-3/A4) — present on a
 * fresh fetch, null/[] on a cache hit.
 */
describe("AnalystRatingsService — targetLow/High and revisions mapping", () => {
  let service: AnalystRatingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue(null);
    upsertMock.mockResolvedValue({});
    service = new AnalystRatingsService();
  });

  it("maps targetLowPrice/targetHighPrice when financialData returns them", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175, targetLowPrice: 140, targetHighPrice: 210 },
      recommendationTrend: { trend: [{ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 }] },
    });

    const result = await service.fetchAnalystRatings("AAPL");

    expect(result.targetLowPrice).toBe(140);
    expect(result.targetHighPrice).toBe(210);
  });

  it("defaults targetLowPrice/targetHighPrice to null when financialData omits them", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175 },
      recommendationTrend: { trend: [{ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 }] },
    });

    const result = await service.fetchAnalystRatings("ENGI.PA");

    expect(result.targetLowPrice).toBeNull();
    expect(result.targetHighPrice).toBeNull();
  });

  it("maps upgradeDowngradeHistory.history into typed revisions when present", async () => {
    const epochGradeDate = new Date("2026-06-01T00:00:00.000Z");
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175 },
      recommendationTrend: { trend: [{ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 }] },
      upgradeDowngradeHistory: {
        history: [
          { firm: "Morgan Stanley", toGrade: "Overweight", fromGrade: "Equal-Weight", action: "up", epochGradeDate },
          { firm: "Barclays", toGrade: "Equal-Weight", fromGrade: "Equal-Weight", action: "main", epochGradeDate },
        ],
      },
    });

    const result = await service.fetchAnalystRatings("AAPL");

    expect(result.revisions).toHaveLength(2);
    expect(result.revisions[0]).toEqual({
      firm: "Morgan Stanley",
      action: "up",
      fromGrade: "Equal-Weight",
      toGrade: "Overweight",
      date: epochGradeDate.toISOString(),
    });
  });

  it("returns an empty revisions array when upgradeDowngradeHistory is absent or empty", async () => {
    safeQuoteSummaryMock.mockResolvedValueOnce({
      financialData: { targetMeanPrice: 175 },
      recommendationTrend: { trend: [{ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 }] },
      // upgradeDowngradeHistory intentionally absent
    });

    const result = await service.fetchAnalystRatings("ENGI.PA");

    expect(result.revisions).toEqual([]);
  });

  it("returns null/[] for targetLow/High and revisions on a cache hit (non-persisted fields)", async () => {
    findUniqueMock.mockResolvedValueOnce({
      symbol: "AAPL",
      targetPrice: 175,
      strongBuy: 5,
      buy: 3,
      hold: 2,
      sell: 0,
      strongSell: 0,
      totalAnalysts: 10,
      averageRating: 2,
      score: 7,
      scoreInterpretation: "Buy",
      lastUpdated: new Date(), // fresh — within 24h
    });

    const result = await service.fetchAnalystRatings("AAPL");

    expect(result.targetLowPrice).toBeNull();
    expect(result.targetHighPrice).toBeNull();
    expect(result.revisions).toEqual([]);
    expect(safeQuoteSummaryMock).not.toHaveBeenCalled();
  });
});
