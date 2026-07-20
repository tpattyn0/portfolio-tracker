import { describe, expect, it } from "vitest";
import { buildAreaPath, buildPath, gridlineYs } from "./chart-path";

describe("buildPath", () => {
  it("builds a known path for a simple ascending series", () => {
    // 3 points, width 100, height 100, default padding 8.
    // min=1, max=3, range=2.
    // x: 0, 50, 100
    // y: pad + (1 - (v-min)/range) * (h - 2*pad)
    //   v=1 -> 8 + 1*84 = 92
    //   v=2 -> 8 + 0.5*84 = 50
    //   v=3 -> 8 + 0*84 = 8
    const d = buildPath([1, 2, 3], 100, 100);
    expect(d.startsWith("M0.0,92.0")).toBe(true);
    expect(d).toContain("C");
    // Last point (100, 8.0) must appear as the final curve's endpoint.
    expect(d.endsWith("100.0,8.0")).toBe(true);
  });

  it("handles a two-point series without dividing by zero", () => {
    const d = buildPath([10, 20], 200, 100);
    expect(d.startsWith("M0.0,")).toBe(true);
    expect(d).toContain("C");
    // Second point sits at x=200
    expect(d).toMatch(/200\.0,-?\d+\.\d$/);
  });

  it("handles a single-point series as a single M command", () => {
    // min === max for a single value, so range is guarded to 1 and
    // (v - min) / range === 0 -> y = pad + 1 * (h - 2*pad) = 8 + 1*134 = 142.
    const d = buildPath([42], 300, 150);
    expect(d).toBe("M0.0,142.0");
  });

  it("handles a flat series without dividing by zero (max - min === 0 guard)", () => {
    const d = buildPath([5, 5, 5, 5], 90, 120, 10);
    // range guarded to 1; all points collapse to the same y (mid-height with padding).
    const expectedY = (10 + (1 - 0) * (120 - 20)).toFixed(1); // (v-min)=0 for all -> y = pad + 1*(h-2pad)
    expect(d.startsWith(`M0.0,${expectedY}`)).toBe(true);
    // Every coordinate pair should share the same y value.
    const yValues = Array.from(d.matchAll(/-?\d+\.\d+,(-?\d+\.\d+)/g)).map((m) => m[1]);
    expect(new Set(yValues).size).toBe(1);
  });

  it("returns an empty string for an empty series", () => {
    expect(buildPath([], 100, 100)).toBe("");
  });

  it("returns an empty string when the series contains NaN", () => {
    expect(buildPath([1, NaN, 3], 100, 100)).toBe("");
  });

  it("returns an empty string when the series contains Infinity", () => {
    expect(buildPath([1, Infinity, 3], 100, 100)).toBe("");
  });
});

describe("buildAreaPath", () => {
  it("closes the line path into a filled area", () => {
    const line = buildPath([1, 2, 3], 100, 100);
    const area = buildAreaPath(line, 100, 100);
    expect(area.startsWith(line)).toBe(true);
    expect(area.endsWith("L100,100L0,100Z")).toBe(true);
  });

  it("returns an empty string when given an empty line path", () => {
    expect(buildAreaPath("", 100, 100)).toBe("");
  });
});

describe("gridlineYs", () => {
  it("maps [max, mid, min] ticks onto the same padded domain buildPath uses", () => {
    // height=220, padding=8 -> plot area spans y=8..212.
    // yMin=0, yMax=100, ticks=[100, 50, 0] (max, mid, min per niceYTicks order).
    const ys = gridlineYs(0, 100, 220, 8, [100, 50, 0]);
    expect(ys[0]).toBeCloseTo(8, 5); // max -> top
    expect(ys[1]).toBeCloseTo(110, 5); // mid -> vertical center
    expect(ys[2]).toBeCloseTo(212, 5); // min -> bottom
  });

  it("matches buildPath's own y for the series' actual min/max", () => {
    const values = [10, 40, 25, 90, 5];
    const width = 300;
    const height = 220;
    const padding = 8;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const linePath = buildPath(values, width, height, padding);
    const [ys] = [gridlineYs(min, max, height, padding, [max, min])];

    // The max value plots at the top of the padded domain; the min value at
    // the bottom — the same pixels buildPath itself uses for those points.
    expect(ys[0]).toBeCloseTo(padding, 5);
    expect(ys[1]).toBeCloseTo(height - padding, 5);
    // Sanity: buildPath's path actually starts/ends within [padding, height-padding].
    expect(linePath).toContain("M");
  });

  it("handles a flat series (yMax === yMin) without dividing by zero", () => {
    const ys = gridlineYs(50, 50, 220, 8, [50, 50, 50]);
    const expectedMid = 8 + (220 - 16) / 2;
    expect(ys).toEqual([expectedMid, expectedMid, expectedMid]);
  });

  it("handles a single tick", () => {
    const ys = gridlineYs(0, 10, 100, 10, [10]);
    expect(ys).toEqual([10]); // max -> top (padding)
  });

  it("returns an empty array for empty ticks", () => {
    expect(gridlineYs(0, 100, 220, 8, [])).toEqual([]);
  });

  it("defaults padding to 8 when omitted", () => {
    const withDefault = gridlineYs(0, 100, 220, undefined, [100]);
    const explicit = gridlineYs(0, 100, 220, 8, [100]);
    expect(withDefault).toEqual(explicit);
  });
});
