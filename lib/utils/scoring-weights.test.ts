import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCORING_WEIGHTS,
  normalizeWeights,
  normalizeCompositeWeights,
  normalizeFundamentalWeights,
  weightedCompositeTotal,
  weightedFundamentalTotal,
  weightsEqualDefaults,
} from "./scoring-weights";

describe("DEFAULT_SCORING_WEIGHTS", () => {
  it("matches the previously-hardcoded composite weights (overview.tsx)", () => {
    expect(DEFAULT_SCORING_WEIGHTS.composite).toEqual({
      intrinsicValue: 0.25,
      fundamental: 0.25,
      technical: 0.2,
      sentiment: 0.15,
      analyst: 0.15,
    });
  });

  it("matches the previously-hardcoded fundamental weights (fundamental-analysis.service.ts)", () => {
    expect(DEFAULT_SCORING_WEIGHTS.fundamental).toEqual({
      valuation: 0.3,
      profitability: 0.3,
      growth: 0.2,
      financial: 0.15,
      dividend: 0.05,
    });
  });

  it("both groups sum to 1.0 as authored", () => {
    const c = DEFAULT_SCORING_WEIGHTS.composite;
    const compositeSum = c.intrinsicValue + c.fundamental + c.technical + c.sentiment + c.analyst;
    expect(compositeSum).toBeCloseTo(1.0, 10);

    const f = DEFAULT_SCORING_WEIGHTS.fundamental;
    const fundamentalSum = f.valuation + f.profitability + f.growth + f.financial + f.dividend;
    expect(fundamentalSum).toBeCloseTo(1.0, 10);
  });
});

describe("normalizeWeights", () => {
  const defaults = { a: 0.5, b: 0.3, c: 0.2 };

  it("defaults normalize to themselves (backward-compat proof — a no-op)", () => {
    expect(normalizeWeights(defaults, defaults)).toEqual(defaults);
  });

  it("normal case: divides each weight by the group sum", () => {
    const result = normalizeWeights({ a: 2, b: 1, c: 1 }, defaults);
    expect(result.a).toBeCloseTo(0.5, 10);
    expect(result.b).toBeCloseTo(0.25, 10);
    expect(result.c).toBeCloseTo(0.25, 10);
    expect(result.a + result.b + result.c).toBeCloseTo(1.0, 10);
  });

  it("all-zero group falls back to defaults, not equal weights", () => {
    const result = normalizeWeights({ a: 0, b: 0, c: 0 }, defaults);
    expect(result).toEqual(defaults);
  });

  it("all-negative group (clamped to zero) falls back to defaults", () => {
    const result = normalizeWeights({ a: -5, b: -1, c: -10 }, defaults);
    expect(result).toEqual(defaults);
  });

  it("single non-zero weight yields 1.0 for that dimension, 0.0 for the rest", () => {
    const result = normalizeWeights({ a: 0, b: 7, c: 0 }, defaults);
    expect(result).toEqual({ a: 0, b: 1, c: 0 });
  });

  it("clamps negative inputs to 0 before summing (mixed positive/negative)", () => {
    const result = normalizeWeights({ a: -5, b: 10, c: 10 }, defaults);
    expect(result.a).toBe(0);
    expect(result.b).toBeCloseTo(0.5, 10);
    expect(result.c).toBeCloseTo(0.5, 10);
  });

  it("non-finite (NaN/Infinity) inputs are treated as 0", () => {
    const result = normalizeWeights({ a: NaN, b: Infinity, c: 5 }, defaults);
    // Infinity is not `> 0` guarded safely by Number.isFinite, so it's clamped to 0.
    expect(result.a).toBe(0);
    expect(result.b).toBe(0);
    expect(result.c).toBe(1);
  });
});

describe("normalizeCompositeWeights", () => {
  it("with no input, returns the defaults unchanged", () => {
    expect(normalizeCompositeWeights(undefined)).toEqual(DEFAULT_SCORING_WEIGHTS.composite);
    expect(normalizeCompositeWeights(null)).toEqual(DEFAULT_SCORING_WEIGHTS.composite);
  });

  it("with a partial input, fills missing keys from defaults before normalizing", () => {
    // Only technical set — others fall back to defaults, then the whole group renormalizes.
    const result = normalizeCompositeWeights({ technical: 1 });
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

describe("normalizeFundamentalWeights", () => {
  it("with no input, returns the defaults unchanged", () => {
    expect(normalizeFundamentalWeights(undefined)).toEqual(DEFAULT_SCORING_WEIGHTS.fundamental);
  });
});

describe("weightedCompositeTotal", () => {
  it("reproduces overview.tsx's current formula for a known score set with default weights", () => {
    const scores = {
      intrinsicValue: 8,
      fundamental: 6,
      technical: 7,
      sentiment: 5,
      analyst: 9,
    };
    const expected =
      8 * 0.25 + 6 * 0.25 + 7 * 0.2 + 5 * 0.15 + 9 * 0.15;
    const result = weightedCompositeTotal(scores, DEFAULT_SCORING_WEIGHTS.composite);
    expect(result).toBeCloseTo(Math.round(expected * 10) / 10, 10);
  });

  it("substitutes a neutral 5 for a missing (null/undefined) dimension", () => {
    const scores = {
      intrinsicValue: null,
      fundamental: 8,
      technical: undefined,
      sentiment: 5,
      analyst: 5,
    };
    const result = weightedCompositeTotal(scores, DEFAULT_SCORING_WEIGHTS.composite);
    const expected = 5 * 0.25 + 8 * 0.25 + 5 * 0.2 + 5 * 0.15 + 5 * 0.15;
    expect(result).toBeCloseTo(Math.round(expected * 10) / 10, 10);
  });

  it("with a single-dimension weighting (100% technical), the composite equals that dimension's score", () => {
    const weights = normalizeCompositeWeights({ technical: 1, intrinsicValue: 0, fundamental: 0, sentiment: 0, analyst: 0 });
    const scores = { intrinsicValue: 2, fundamental: 2, technical: 9, sentiment: 2, analyst: 2 };
    expect(weightedCompositeTotal(scores, weights)).toBe(9);
  });
});

describe("weightedFundamentalTotal", () => {
  it("reproduces the current default-weighted number for a known breakdown", () => {
    const breakdown = {
      valuation: 7,
      profitability: 6,
      growth: 8,
      financial: 5,
      dividend: 3,
    };
    const expected =
      (7 * 0.3 + 6 * 0.3 + 8 * 0.2 + 5 * 0.15 + 3 * 0.05) / (0.3 + 0.3 + 0.2 + 0.15 + 0.05);
    const result = weightedFundamentalTotal(breakdown, DEFAULT_SCORING_WEIGHTS.fundamental);
    expect(result).toBeCloseTo(expected, 10);
  });

  it("with normalized weights (sum 1.0), the division by weightSum is a no-op", () => {
    const breakdown = { valuation: 10, profitability: 0, growth: 0, financial: 0, dividend: 0 };
    const weights = normalizeFundamentalWeights({ valuation: 1, profitability: 0, growth: 0, financial: 0, dividend: 0 });
    expect(weightedFundamentalTotal(breakdown, weights)).toBe(10);
  });

  it("returns 0 defensively if passed an all-zero (un-normalized) weight group", () => {
    const breakdown = { valuation: 7, profitability: 6, growth: 8, financial: 5, dividend: 3 };
    const result = weightedFundamentalTotal(breakdown, { valuation: 0, profitability: 0, growth: 0, financial: 0, dividend: 0 });
    expect(result).toBe(0);
  });
});

describe("weightsEqualDefaults", () => {
  it("returns true for undefined/null weights (treated as defaults)", () => {
    expect(weightsEqualDefaults(undefined, DEFAULT_SCORING_WEIGHTS.composite)).toBe(true);
    expect(weightsEqualDefaults(null, DEFAULT_SCORING_WEIGHTS.composite)).toBe(true);
  });

  it("returns true when weights exactly equal defaults", () => {
    expect(weightsEqualDefaults(DEFAULT_SCORING_WEIGHTS.composite, DEFAULT_SCORING_WEIGHTS.composite)).toBe(true);
  });

  it("returns false when any key differs", () => {
    const custom = { ...DEFAULT_SCORING_WEIGHTS.composite, technical: 0.5 };
    expect(weightsEqualDefaults(custom, DEFAULT_SCORING_WEIGHTS.composite)).toBe(false);
  });
});
