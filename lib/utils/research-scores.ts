/**
 * Shared 0-10 score derivations reused across the research-detail tabs
 * (Overview, Intrinsic value, News & sentiment) — extracted from
 * `overview.tsx` (plans/2026-07-18-meridian-research-detail.md, Task 4) so
 * each tab's headline score matches the Overview dimension exactly. Pure
 * functions: no DOM, no React, no side effects.
 */

/** Maps a -1..1 sentiment score to a 0..10 scale, clamped. */
export function sentimentToScore(sent: number | null | undefined): number {
  const s = typeof sent === "number" ? sent : 0;
  const score = (s + 1) * 5;
  return Math.max(0, Math.min(10, score));
}

/**
 * Below this many analysed articles, a headline sentiment score is
 * continuously damped toward the neutral midpoint (5.0) by
 * `dampenForSample` — plans/2026-07-24-news-sentiment-accuracy.md, Task 11.
 * Chosen so the owner's 2-article case is visibly damped while a realistic
 * 15-30 article corpus (the plan's measured RSS volume) is unaffected — a
 * starting value, not a derived constant (see the plan's `## Assumptions`).
 */
export const MIN_CONFIDENT_SAMPLE = 5;

/** Exponent controlling how sharply calibratedSentimentToScore compresses the extremes. */
const CALIBRATION_EXPONENT = 1.4;

/**
 * Calibrated -1..1 sentiment -> 0..10 map (plan Task 11) — replaces the
 * linear `sentimentToScore` for headline scoring. Compresses the extremes
 * (`score = 5 + 5 * sign(s) * |s|^CALIBRATION_EXPONENT`) so genuinely
 * uniform, high-conviction coverage is required to reach the 8+ band; mild
 * positive coverage (the ±0.2-0.4 promotional-genre anchor from Task 10's
 * prompt) lands in the 6-7 band instead of inflating toward 10. The neutral
 * midpoint (`s = 0`) still maps to exactly 5.0, and the function remains
 * monotonic and symmetric — only its steepness away from the midpoint
 * changes versus the old linear map.
 *
 * `sentimentToScore` above is intentionally left byte-identical (still
 * consumed wherever the linear map is the documented, tested contract) —
 * this is a new, separate export, not a replacement in place. All three
 * call sites that build a News & sentiment headline score
 * (`components/news-feed.tsx`, `components/overview.tsx`,
 * `lib/services/wishlist.service.ts`) must use this function, never the
 * linear one, so they cannot silently diverge (plan Task 11).
 */
export function calibratedSentimentToScore(sent: number | null | undefined): number {
  const s = typeof sent === "number" ? Math.max(-1, Math.min(1, sent)) : 0;
  const sign = s < 0 ? -1 : 1;
  const score = 5 + 5 * sign * Math.pow(Math.abs(s), CALIBRATION_EXPONENT);
  return Math.max(0, Math.min(10, score));
}

/**
 * Continuously shrinks `score` toward the neutral midpoint (5.0) in
 * proportion to how far `analysedCount` falls below `MIN_CONFIDENT_SAMPLE`
 * (plan Task 11, S2) — no cliff at the boundary: the damping factor is
 * `min(1, analysedCount / MIN_CONFIDENT_SAMPLE)`, so a 1-article sample is
 * damped far more than a 4-article one, and at/above the threshold the
 * score passes through unchanged.
 */
export function dampenForSample(
  score: number,
  analysedCount: number,
  minConfidentSample: number = MIN_CONFIDENT_SAMPLE
): number {
  if (!Number.isFinite(score)) return score;
  const safeCount = Math.max(0, analysedCount);
  const factor = minConfidentSample > 0 ? Math.min(1, safeCount / minConfidentSample) : 1;
  return 5 + (score - 5) * factor;
}

/**
 * Maps intrinsic-value upside% to a 0..10 scale: -25% -> 0, 0% -> 5,
 * +30% -> 10 (clamped). Missing upside defaults to a neutral 5.
 */
export function upsideToScore(upsidePercent: number | null | undefined): number {
  if (upsidePercent === null || upsidePercent === undefined) return 5;
  const min = -25;
  const max = 30;
  const clamped = Math.max(min, Math.min(max, upsidePercent));
  const normalized = (clamped - min) / (max - min);
  return Math.round(normalized * 10 * 10) / 10;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Composite-score verdict label, context-aware (MRD-Q1): "portfolio" context
 * (the symbol is held) uses position-management wording; "wishlist" context
 * (not held) uses buy-oriented wording. Presentational only — the same
 * boundaries (8.5 / 7.0 / 5.0) `overview.tsx`'s composite score has always
 * used; this only extracts the label choice into a pure, testable function.
 */
export function verdictLabel(score: number, context: "portfolio" | "wishlist"): string {
  if (context === "portfolio") {
    if (score >= 8.5) return "BUY MORE";
    if (score >= 7.0) return "HOLD";
    if (score >= 5.0) return "REDUCE";
    return "SELL";
  }
  if (score >= 8.5) return "STRONG BUY";
  if (score >= 7.0) return "BUY";
  if (score >= 5.0) return "WATCH";
  return "AVOID";
}
