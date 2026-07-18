import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan Task 5: news.service's getAnalyzedNewsForSymbol previously analyzed
 * up-to-3 unanalyzed articles in a sequential `for…await` loop. This test
 * asserts the batch now runs concurrently (all three Gemini calls start
 * before any resolves) and that a single article's analysis failure does
 * not prevent the others from being attempted or throw out of the method
 * (parity with the old try/catch-per-article behavior).
 */

let callOrder: string[] = [];
function tick(ms = 5) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const unanalyzedArticles = [
  { id: "a1", sentiment: null },
  { id: "a2", sentiment: null },
  { id: "a3", sentiment: null },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsArticle: {
      findMany: vi.fn(async () => unanalyzedArticles),
    },
  },
}));

vi.mock("./sentiment.service", () => ({
  sentimentService: {
    analyzeAndUpdateArticle: vi.fn(async (id: string) => {
      callOrder.push(`${id}-start`);
      if (id === "a2") {
        await tick();
        callOrder.push(`${id}-end`);
        throw new Error("gemini failure for a2");
      }
      await tick();
      callOrder.push(`${id}-end`);
    }),
  },
}));

import { NewsAggregationService } from "./news.service";
import { sentimentService } from "./sentiment.service";

describe("NewsAggregationService.getAnalyzedNewsForSymbol Gemini batch (plan Task 5)", () => {
  let service: NewsAggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];
    service = new NewsAggregationService();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("analyzes the up-to-3 unanalyzed articles concurrently, not sequentially", async () => {
    await service.getAnalyzedNewsForSymbol("AAPL", { analyze: true });

    expect(sentimentService.analyzeAndUpdateArticle).toHaveBeenCalledTimes(3);

    const starts = callOrder.filter((c) => c.endsWith("-start"));
    const firstEndIndex = callOrder.findIndex((c) => c.endsWith("-end"));
    expect(starts).toHaveLength(3);
    expect(starts.every((s) => callOrder.indexOf(s) < firstEndIndex)).toBe(true);
  });

  it("does not throw when one article's analysis fails — the others still complete (parity with sequential try/catch)", async () => {
    await expect(
      service.getAnalyzedNewsForSymbol("AAPL", { analyze: true })
    ).resolves.toBeDefined();

    expect(callOrder).toContain("a1-end");
    expect(callOrder).toContain("a2-end");
    expect(callOrder).toContain("a3-end");
  });
});
