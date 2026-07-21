import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan Task 5 (2026-07-18-performance-audit-remediation): the five per-item
 * score fetches inside getWishlistWithScores used to be sequential awaits
 * with no data dependency between them. This test asserts (a) they now run
 * concurrently — each mock records its start time, and the assertion checks
 * they all started within the same tick, before any resolved — and (b) the
 * composite score for a fixed fixture is unchanged from what the
 * sequential version would have produced (no math change, only ordering).
 */

vi.mock("@/lib/prisma", () => {
  const wishlistItem = {
    id: "item-1",
    wishlistId: "wishlist-1",
    ticker: "AAPL",
    name: "Apple Inc.",
    currency: "USD",
    addedPrice: 100,
    currentPrice: 100,
    targetPrice: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
  };

  return {
    prisma: {
      wishlist: {
        findUnique: vi.fn().mockResolvedValue({ id: "wishlist-1", userId: "user-1", items: [] }),
        create: vi.fn(),
      },
      wishlistItem: {
        findMany: vi.fn().mockResolvedValue([wishlistItem]),
        update: vi.fn().mockResolvedValue(wishlistItem),
      },
      analystRating: {
        findUnique: vi.fn(async () => {
          callOrder.push("analyst-start");
          await tick();
          callOrder.push("analyst-end");
          return { score: 7, targetPrice: 120 };
        }),
      },
      userScoringPreferences: {
        // No row — getWeights falls back to DEFAULT_SCORING_WEIGHTS, matching
        // this test's pre-existing hand-computed expected composite exactly
        // (plans/2026-07-20-configurable-scoring-weights.md, Task 8).
        findUnique: vi.fn().mockResolvedValue(null),
      },
    },
  };
});

vi.mock("@/lib/yahoo-finance", () => ({
  default: {
    quote: vi.fn().mockResolvedValue({ regularMarketPrice: 100, currency: "USD" }),
  },
}));

let callOrder: string[] = [];
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

vi.mock("./market-data.service", () => ({
  marketDataService: {
    getHistoricalData: vi.fn(async () => {
      callOrder.push("technical-start");
      await tick();
      callOrder.push("technical-end");
      return [{ value: 100, volume: 1000 }];
    }),
  },
}));

vi.mock("./technical-analysis.service", () => ({
  technicalAnalysisService: {
    calculateIndicators: vi.fn().mockReturnValue({ score: 6 }),
  },
}));

vi.mock("./fundamental-analysis.service", () => ({
  fundamentalAnalysisService: {
    fetchFundamentals: vi.fn(async () => {
      callOrder.push("fundamental-start");
      await tick();
      callOrder.push("fundamental-end");
      return { score: { total: 8 } };
    }),
  },
}));

vi.mock("./news.service", () => ({
  newsService: {
    getAnalyzedNewsForSymbol: vi.fn(async () => {
      callOrder.push("sentiment-start");
      await tick();
      callOrder.push("sentiment-end");
      return [];
    }),
  },
}));

vi.mock("./intrinsic-value.service", () => ({
  IntrinsicValueService: {
    calculateIntrinsicValue: vi.fn(async () => {
      callOrder.push("intrinsic-start");
      await tick();
      callOrder.push("intrinsic-end");
      return { upsidePercent: 10 };
    }),
  },
}));

import { wishlistService } from "./wishlist.service";

describe("WishlistService.getWishlistWithScores concurrency + parity (plan Task 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];
  });

  it("issues all five per-item score fetches concurrently (all start before any ends)", async () => {
    await wishlistService.getWishlistWithScores("user-1");

    const starts = callOrder.filter((c) => c.endsWith("-start"));
    const firstEndIndex = callOrder.findIndex((c) => c.endsWith("-end"));

    expect(starts).toHaveLength(5);
    // Every "-start" must appear before the first "-end" — i.e. all five
    // fetches were in flight concurrently, not sequential.
    const allStartsBeforeFirstEnd = starts.every((s) => callOrder.indexOf(s) < firstEndIndex);
    expect(allStartsBeforeFirstEnd).toBe(true);
  });

  it("produces the same composite score as the pre-parallelization sequential version for a fixed fixture", async () => {
    const results = await wishlistService.getWishlistWithScores("user-1");

    expect(results).toHaveLength(1);
    // fundamental=8, analyst=7, technical=6, sentiment=5 (empty articles ->
    // neutral default), intrinsic score from upsidePercent=10 via
    // upsideToScore (min=-25,max=30): (10-(-25))/(30-(-25)) = 35/55 = 0.6364,
    // *10 rounded to 1dp = 6.4.
    // weighted = 6.4*.25 + 8*.25 + 6*.20 + 5*.15 + 7*.15
    //          = 1.6 + 2.0 + 1.2 + 0.75 + 1.05 = 6.6
    expect(results[0].fundamentalScore).toBe(8);
    expect(results[0].analystScore).toBe(7);
    expect(results[0].technicalScore).toBe(6);
    expect(results[0].compositeScore).toBe(6.6);
  });
});
