import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_SCORING_WEIGHTS, normalizeCompositeWeights, weightedCompositeTotal } from "@/lib/utils/scoring-weights";

/**
 * Task 8 (plans/2026-07-20-configurable-scoring-weights.md) — the wishlist
 * must use the SAME shared scoring functions as the research Overview tab,
 * not a second definition. Asserts: (a) a user with a custom composite
 * weighting gets a composite matching weightedCompositeTotal directly (the
 * "wishlist === overview for the same stock+user" invariant, since
 * overview.tsx calls the identical shared function with the identical
 * normalized weights), and (b) the user's fundamental weights are passed
 * through to fetchFundamentals.
 */

let userScoringPreferencesRow: Record<string, number | null> | null;

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
        findUnique: vi.fn().mockResolvedValue({ score: 7, targetPrice: 120 }),
      },
      userScoringPreferences: {
        findUnique: vi.fn(async () => userScoringPreferencesRow),
      },
    },
  };
});

vi.mock("@/lib/yahoo-finance", () => ({
  default: {
    quote: vi.fn().mockResolvedValue({ regularMarketPrice: 100, currency: "USD" }),
  },
}));

vi.mock("./market-data.service", () => ({
  marketDataService: {
    getHistoricalData: vi.fn().mockResolvedValue([{ value: 100, volume: 1000 }]),
  },
}));

vi.mock("./technical-analysis.service", () => ({
  technicalAnalysisService: {
    calculateIndicators: vi.fn().mockReturnValue({ score: 6 }),
  },
}));

const fetchFundamentalsMock = vi.fn();
vi.mock("./fundamental-analysis.service", () => ({
  fundamentalAnalysisService: {
    fetchFundamentals: (...args: unknown[]) => fetchFundamentalsMock(...args),
  },
}));

vi.mock("./news.service", () => ({
  newsService: {
    getAnalyzedNewsForSymbol: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./intrinsic-value.service", () => ({
  IntrinsicValueService: {
    calculateIntrinsicValue: vi.fn().mockResolvedValue({ upsidePercent: 10 }),
  },
}));

import { wishlistService } from "./wishlist.service";

describe("WishlistService.getWishlistWithScores — single source of truth (Task 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFundamentalsMock.mockResolvedValue({ score: { total: 8 } });
  });

  it("with no preferences row, the composite is unchanged vs. today (defaults)", async () => {
    userScoringPreferencesRow = null;
    const results = await wishlistService.getWishlistWithScores("user-1");

    const expected = weightedCompositeTotal(
      { intrinsicValue: 6.4, fundamental: 8, technical: 6, sentiment: 5, analyst: 7 },
      DEFAULT_SCORING_WEIGHTS.composite
    );
    expect(results[0].compositeScore).toBeCloseTo(expected, 5);
  });

  it("with custom composite weights, the composite matches weightedCompositeTotal directly (wishlist === overview invariant)", async () => {
    userScoringPreferencesRow = {
      wCompositeIntrinsic: 0,
      wCompositeFundamental: 0,
      wCompositeTechnical: 1,
      wCompositeSentiment: 0,
      wCompositeAnalyst: 0,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    };

    const results = await wishlistService.getWishlistWithScores("user-1");

    // 100% technical weighting -> composite equals the technical score (6),
    // exactly what overview.tsx's weightedCompositeTotal call would produce
    // for the same scores + the same normalized weights.
    const normalized = normalizeCompositeWeights({ technical: 1, intrinsicValue: 0, fundamental: 0, sentiment: 0, analyst: 0 });
    const expected = weightedCompositeTotal(
      { intrinsicValue: 6.4, fundamental: 8, technical: 6, sentiment: 5, analyst: 7 },
      normalized
    );
    expect(results[0].compositeScore).toBe(expected);
    expect(expected).toBe(6);
  });

  it("passes the user's fundamental weights through to fetchFundamentals(item.ticker, weights.fundamental)", async () => {
    userScoringPreferencesRow = {
      wCompositeIntrinsic: null,
      wCompositeFundamental: null,
      wCompositeTechnical: null,
      wCompositeSentiment: null,
      wCompositeAnalyst: null,
      wFundValuation: 1,
      wFundProfitability: 0,
      wFundGrowth: 0,
      wFundFinancial: 0,
      wFundDividend: 0,
    };

    await wishlistService.getWishlistWithScores("user-1");

    expect(fetchFundamentalsMock).toHaveBeenCalledWith("AAPL", {
      valuation: 1,
      profitability: 0,
      growth: 0,
      financial: 0,
      dividend: 0,
    });
  });
});

describe("Task 8 grep invariant — no hardcoded scoring-weights object outside the shared module", () => {
  it("wishlist.service.ts no longer defines its own composite weights object", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(new URL("./wishlist.service.ts", import.meta.url), "utf-8");
    // The old inline weights object literal (intrinsicValue: 0.25, ...) must
    // be gone — the file should import normalizeCompositeWeights/
    // weightedCompositeTotal instead of redefining the formula.
    expect(source).not.toMatch(/intrinsicValue:\s*0\.25/);
    expect(source).toContain("weightedCompositeTotal");
    expect(source).toContain("normalizeCompositeWeights");
  });
});
