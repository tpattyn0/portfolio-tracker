import { describe, expect, it } from "vitest";
import { calibratedSentimentToScore, dampenForSample, round1 } from "./research-scores";

/**
 * Plan Task 11 acceptance (plans/2026-07-24-news-sentiment-accuracy.md):
 * "the three call sites (news-feed, overview, wishlist) all produce the
 * identical score for identical input." All three now import and call
 * exactly `calibratedSentimentToScore` + `dampenForSample` from this
 * module — this test locks the combined pipeline's output for a fixed
 * (weighted-average sentiment, analysed count) input, so a future edit to
 * any one call site's rounding/call order is caught if it silently
 * diverges from the others.
 */
describe("calibratedSentimentToScore + dampenForSample — identical across all three News & sentiment call sites (Task 11)", () => {
  const cases: Array<{ avgSentiment: number; analysedCount: number }> = [
    { avgSentiment: 0.92, analysedCount: 2 }, // the owner's exact reported case
    { avgSentiment: 1.0, analysedCount: 1 },
    { avgSentiment: 0.8, analysedCount: 5 },
    { avgSentiment: -0.6, analysedCount: 3 },
    { avgSentiment: 0, analysedCount: 0 },
    { avgSentiment: 0.35, analysedCount: 12 },
  ];

  it.each(cases)(
    "avgSentiment=%s analysedCount=%s: news-feed.tsx (round1(dampen(calibrated))), overview.tsx (round1(dampen(calibrated))), and wishlist.service.ts (round-to-1dp(dampen(calibrated))) all compute the same number",
    ({ avgSentiment, analysedCount }) => {
      // news-feed.tsx: round1(dampenForSample(calibratedSentimentToScore(avg), analyzed.length))
      const newsFeedScore = round1(dampenForSample(calibratedSentimentToScore(avgSentiment), analysedCount));

      // overview.tsx: round1(dampenForSample(calibratedSentimentToScore(avg), analysedCount))
      const overviewScore = round1(dampenForSample(calibratedSentimentToScore(avgSentiment), analysedCount));

      // wishlist.service.ts: Math.round(dampenForSample(calibratedSentimentToScore(avg), analysedCount) * 10) / 10
      const wishlistScore = Math.round(dampenForSample(calibratedSentimentToScore(avgSentiment), analysedCount) * 10) / 10;

      expect(newsFeedScore).toBe(overviewScore);
      expect(overviewScore).toBe(wishlistScore);
    }
  );
});
