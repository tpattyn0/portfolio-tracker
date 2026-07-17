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
 * Maps a series of numeric values onto an SVG path string, plotting each value
 * evenly spaced across `width` and vertically scaled (inverted — larger values
 * plot higher) within `height`, with `padding` px of vertical breathing room at
 * top and bottom. Adjacent points are joined with cubic Bezier segments whose
 * control points approximate a Catmull-Rom spline, producing a smooth curve
 * that (unlike Recharts' monotone interpolation) can overshoot slightly between
 * points — this is the design's intended "hand-drawn" curve quality.
 *
 * Degenerate cases handled explicitly:
 * - Empty or all-NaN input -> "" (nothing to draw).
 * - Single point -> a zero-length path at that point (a single "M" command).
 * - Flat series (max === min) -> the `|| 1` range guard avoids a divide-by-zero;
 *   the line renders as a flat horizontal midline.
 */
export function buildPath(
  values: number[],
  width: number,
  height: number,
  padding = 8
): string {
  const finiteValues = values.filter((v) => Number.isFinite(v));
  if (finiteValues.length === 0 || finiteValues.length !== values.length) {
    // Any non-finite entry (NaN/Infinity) makes the series unplottable as a
    // continuous line — bail out rather than silently skip points, which
    // would distort the x-axis spacing of everything after the gap.
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points: ChartPoint[] = values.map((v, i) => ({
    x: values.length > 1 ? i * (width / (values.length - 1)) : 0,
    y: padding + (1 - (v - min) / range) * (height - 2 * padding),
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
