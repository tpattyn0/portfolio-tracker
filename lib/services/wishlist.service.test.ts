import { describe, it, expect, vi, beforeEach } from "vitest";

// NB: vi.mock factories are hoisted above imports/top-level consts, so the
// fixture must be defined inside the factory rather than shared via a
// module-scope const.
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

vi.mock("./market-data.service", () => ({
  marketDataService: {
    getHistoricalData: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./technical-analysis.service", () => ({
  technicalAnalysisService: {
    calculateIndicators: vi.fn(),
  },
}));

// fundamentalScore = 0 (legitimate, e.g. worst possible fundamentals) — the
// AUD-05 regression this test guards against: `|| 5` would have silently
// replaced this with a neutral 5.
vi.mock("./fundamental-analysis.service", () => ({
  fundamentalAnalysisService: {
    fetchFundamentals: vi.fn().mockResolvedValue({ score: { total: 0 } }),
  },
}));

vi.mock("./news.service", () => ({
  newsService: {
    getAnalyzedNewsForSymbol: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./intrinsic-value.service", () => ({
  IntrinsicValueService: {
    calculateIntrinsicValue: vi.fn().mockResolvedValue({ upsidePercent: null }),
  },
}));

import { wishlistService } from "./wishlist.service";
import { fundamentalAnalysisService } from "./fundamental-analysis.service";

describe("WishlistService.getWishlistWithScores composite score (AUD-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fundamentalAnalysisService.fetchFundamentals as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: { total: 0 },
    });
  });

  it("treats a legitimate score of 0 as a real value, not as missing (?? 5, not || 5)", async () => {
    const results = await wishlistService.getWishlistWithScores("user-1");

    expect(results).toHaveLength(1);
    expect(results[0].fundamentalScore).toBe(0);

    // sentiment(5, default from empty articles) * .15 + fundamental(0) * .25 +
    // technical(null -> ?? 5) * .20 + intrinsic(null -> ?? 5) * .25 + analyst(null -> ?? 5) * .15
    // = 5*.15 + 0*.25 + 5*.20 + 5*.25 + 5*.15 = 0.75 + 0 + 1 + 1.25 + 0.75 = 3.75,
    // rounded to one decimal place by the service = 3.8.
    // With the old `|| 5` bug, fundamentalScore=0 would have been replaced by 5,
    // producing a composite of 5.0 instead.
    expect(results[0].compositeScore).toBe(3.8);
  });
});
