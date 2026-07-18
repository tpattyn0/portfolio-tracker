import { describe, expect, it } from "vitest";
import { niceYTicks } from "./chart-ticks";

describe("niceYTicks", () => {
  it("returns count evenly spaced values from max down to min", () => {
    const ticks = niceYTicks(100, 200, 3);
    expect(ticks).toEqual([200, 150, 100]);
  });

  it("defaults to 3 ticks", () => {
    expect(niceYTicks(0, 10)).toHaveLength(3);
    expect(niceYTicks(0, 10)).toEqual([10, 5, 0]);
  });

  it("supports 4 ticks", () => {
    const ticks = niceYTicks(0, 30, 4);
    expect(ticks).toEqual([30, 20, 10, 0]);
  });

  it("handles a flat series (min === max) without dividing by zero", () => {
    expect(niceYTicks(50, 50, 3)).toEqual([50]);
  });

  it("handles min/max passed in reverse order", () => {
    expect(niceYTicks(200, 100, 3)).toEqual([200, 150, 100]);
  });

  it("returns a single value for count=1", () => {
    expect(niceYTicks(0, 10, 1)).toEqual([10]);
  });

  it("returns an empty array for non-finite input", () => {
    expect(niceYTicks(NaN, 10)).toEqual([]);
    expect(niceYTicks(0, Infinity)).toEqual([]);
  });

  it("returns an empty array for count < 1", () => {
    expect(niceYTicks(0, 10, 0)).toEqual([]);
  });
});
