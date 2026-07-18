/**
 * Pure y-axis tick helper for `DetailPriceChart` (ADR-11,
 * plans/2026-07-18-meridian-research-detail.md). Produces a small ("a few,
 * not a dense axis" per DESIGN.md) set of round-ish values spanning a
 * series' min/max, evenly spaced — used to render the chart's minimal
 * y-axis price labels.
 *
 * No DOM, no React, no side effects.
 */

/**
 * Returns `count` evenly spaced values from `min` to `max` inclusive,
 * ordered high-to-low (top label first, matching the chart's top-to-bottom
 * gridline order). Degenerate cases:
 * - `min === max` (flat series) -> a single-value array repeated `count`
 *   times collapses to one distinct tick: returns `[min]`.
 * - non-finite `min`/`max` -> `[]` (nothing sensible to render).
 * - `count < 1` -> `[]`.
 */
export function niceYTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 1) {
    return [];
  }

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);

  if (hi === lo) {
    return [lo];
  }

  if (count === 1) {
    return [hi];
  }

  const step = (hi - lo) / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(hi - step * i);
  }
  return ticks;
}
