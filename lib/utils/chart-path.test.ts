import { describe, expect, it } from "vitest";
import { buildAreaPath, buildPath } from "./chart-path";

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
