/**
 * Catmull-Rom -> cubic Bezier SVG path builder for the Meridian dashboard
 * performance chart (ADR-10). Ported from the design prototype's
 * `buildPath(vals, w, h)` — see design_handoff_meridian/Meridian Hybrid.dc.html.
 *
 * Pure function: no DOM, no React, no side effects. `components/portfolio-chart.tsx`
 * is the sole caller.
 */

export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Default `domainMargin` for `buildPath`: how much extra vertical headroom
 * (as a fraction of the series' own range) to add above the max and below
 * the min before mapping. Exists to contain Catmull-Rom spline overshoot —
 * see `buildPath`'s doc comment and
 * `plans/2026-07-20-perf-graph-dip-clipping-fix.md`. Tuned so the plan's
 * worst-case reproduction (a dip immediately followed by the series max)
 * maps strictly inside `[padding, height - padding]` with a safety margin;
 * do not lower this without re-running `chart-path.test.ts`'s clip
 * reproduction, and do not set it to 0 in a chart component or the dip
 * re-clips.
 */
export const CHART_DOMAIN_MARGIN = 0.08;

/**
 * Expands `[min, max]` symmetrically by `margin` (a fraction of the range)
 * to produce the domain `buildPath` should draw into and `gridlineYs` should
 * position gridlines against — the single source of truth shared by both, so
 * the line and its gridlines never drift apart (see the `buildPath` and
 * `gridlineYs` fragile-surface entries in `AGENT.md`).
 *
 * `margin = 0` returns `[min, max]` unchanged (today's behaviour). A flat
 * series (`max === min`) also returns `[min, max]` unchanged — a zero range
 * has nothing to proportionally expand, matching `buildPath`'s own flat-
 * series handling (centered midline, no divide-by-zero).
 */
export function marginDomain(
  min: number,
  max: number,
  margin: number
): { domainMin: number; domainMax: number } {
  const range = max - min;
  if (margin === 0 || range === 0) {
    return { domainMin: min, domainMax: max };
  }
  const m = range * margin;
  return { domainMin: min - m, domainMax: max + m };
}

/**
 * Maps a series of numeric values onto an SVG path string, plotting each value
 * evenly spaced across `width` and vertically scaled (inverted — larger values
 * plot higher) within `height`, with `padding` px of vertical breathing room at
 * top and bottom. Adjacent points are joined with cubic Bezier segments whose
 * control points approximate a Catmull-Rom spline, producing a smooth curve
 * that (unlike Recharts' monotone interpolation) can overshoot slightly between
 * points — this is the design's intended "hand-drawn" curve quality.
 *
 * `domainMargin` (default `0`, fully backward compatible) expands the
 * *drawing* domain symmetrically beyond the series' own `[min, max]` via
 * `marginDomain` before mapping values to pixels — the data's own min/max
 * vertices still exist and are still plotted, but the pixel positions they
 * map to no longer sit flush on the plot floor/ceiling. This exists solely to
 * give the Catmull-Rom spline's overshoot (see above) somewhere to go: with
 * `domainMargin = 0`, a series' min vertex plots at exactly `height -
 * padding`, and a steep segment on either side of it can make the
 * interpolated curve dip *below* that vertex — past the plot floor and out of
 * the (unclipped, `preserveAspectRatio="none"`) viewBox. A small headroom
 * margin keeps the whole curve inside `[padding, height - padding]`. Callers
 * that also draw gridlines (`gridlineYs`) must pass the *same* margined
 * domain there, or the line and gridlines will visibly disagree.
 *
 * Degenerate cases handled explicitly:
 * - Empty or all-NaN input -> "" (nothing to draw).
 * - Single point -> a zero-length path at that point (a single "M" command).
 * - Flat series (max === min) -> the `|| 1` range guard avoids a divide-by-zero;
 *   the line renders as a flat horizontal midline. `marginDomain` also leaves
 *   a zero range unchanged, so this case is unaffected by `domainMargin`.
 */
export function buildPath(
  values: number[],
  width: number,
  height: number,
  padding = 8,
  domainMargin = 0
): string {
  const finiteValues = values.filter((v) => Number.isFinite(v));
  if (finiteValues.length === 0 || finiteValues.length !== values.length) {
    // Any non-finite entry (NaN/Infinity) makes the series unplottable as a
    // continuous line — bail out rather than silently skip points, which
    // would distort the x-axis spacing of everything after the gap.
    return "";
  }

  // Computed from finiteValues (identical to values here, since the guard
  // above already bailed on any non-finite entry) so the finiteness safety
  // is local to this computation rather than relying on reasoning across the
  // early return above (MDO-04).
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const { domainMin, domainMax } = marginDomain(min, max, domainMargin);
  const range = domainMax - domainMin || 1;

  const points: ChartPoint[] = values.map((v, i) => ({
    x: values.length > 1 ? i * (width / (values.length - 1)) : 0,
    y: padding + (1 - (v - domainMin) / range) * (height - 2 * padding),
  }));

  if (points.length === 1) {
    return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  }

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Builds the closed fill-area path for `buildPath`'s output: the line path,
 * dropped to the bottom-right corner, then bottom-left, then closed. Mirrors
 * the prototype's `chartLine + 'L{w},{h}L0,{h}Z'`.
 */
export function buildAreaPath(linePath: string, width: number, height: number): string {
  if (!linePath) return "";
  return `${linePath}L${width},${height}L0,${height}Z`;
}

/**
 * Maps each tick value onto the y-pixel it would occupy if plotted by
 * `buildPath`'s own padded domain — i.e. `y(v) = padding + (1 - (v - yMin) /
 * (yMax - yMin)) * (height - 2 * padding)`. Used to position gridlines and
 * their labels so they land exactly where the plotted series' own values
 * fall, instead of at a fixed fraction of the viewBox
 * (`plans/2026-07-20-small-visual-fixes.md`, Issue 4 — closes the bug where a
 * spiky series' max/min rendered outside the labelled gridline band).
 *
 * `yMin`/`yMax` must be the same domain bounds passed to `buildPath` for the
 * same series (typically the series' own min/max) — passing a different
 * domain here would reintroduce the same class of mismatch this helper
 * fixes.
 *
 * Degenerate cases handled explicitly:
 * - `yMax === yMin` (flat series) -> every tick maps to the vertical
 *   midpoint (`padding + (height - 2*padding) / 2`), matching `buildPath`'s
 *   own flat-series behavior (all points collapse to one y).
 * - Empty `ticks` -> `[]`.
 */
export function gridlineYs(
  yMin: number,
  yMax: number,
  height: number,
  padding = 8,
  ticks: number[] = []
): number[] {
  const range = yMax - yMin;
  const mid = padding + (height - 2 * padding) / 2;

  if (range === 0) {
    return ticks.map(() => mid);
  }

  return ticks.map((v) => padding + (1 - (v - yMin) / range) * (height - 2 * padding));
}
