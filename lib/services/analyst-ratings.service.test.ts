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
