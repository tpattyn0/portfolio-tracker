import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCORING_WEIGHTS,
  normalizeWeights,
  normalizeCompositeWeights,
  normalizeFundamentalWeights,
  weightedCompositeTotal,
  weightedFundamentalTotal,
  weightsEqualDefaults,
  fractionsToPercents,
  percentsToFractions,
  sumsTo100,
  SCORING_STYLE_PRESETS,
  presetsForGroup,
  type CompositeWeights,
  type FundamentalWeights,
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

  it("returns false when any key differs (same scale)", () => {
    const custom = { ...DEFAULT_SCORING_WEIGHTS.composite, technical: 0.5 };
    expect(weightsEqualDefaults(custom, DEFAULT_SCORING_WEIGHTS.composite)).toBe(false);
  });

  // DP-I1 (reviews/2026-07-21-scoring-weights-direct-percent.md): GET
  // /api/settings/scoring-weights returns whole percents (getWeightsForSettings)
  // while DEFAULT_SCORING_WEIGHTS stays fractions — the comparison must be
  // scale-agnostic or every default-weights user is wrongly flagged "custom".
  it("returns true for a default-percent composite group compared against the fraction-scaled defaults", () => {
    const defaultPercents = { intrinsicValue: 25, fundamental: 25, technical: 20, sentiment: 15, analyst: 15 };
    expect(weightsEqualDefaults(defaultPercents, DEFAULT_SCORING_WEIGHTS.composite)).toBe(true);
  });

  it("returns true for a default-percent fundamental group compared against the fraction-scaled defaults", () => {
    const defaultPercents = { valuation: 30, profitability: 30, growth: 20, financial: 15, dividend: 5 };
    expect(weightsEqualDefaults(defaultPercents, DEFAULT_SCORING_WEIGHTS.fundamental)).toBe(true);
  });

  it("returns false for a genuinely custom percent composite group vs the fraction-scaled defaults", () => {
    const customPercents = { intrinsicValue: 40, fundamental: 20, technical: 20, sentiment: 10, analyst: 10 };
    expect(weightsEqualDefaults(customPercents, DEFAULT_SCORING_WEIGHTS.composite)).toBe(false);
  });

  it("returns false for a genuinely custom percent fundamental group vs the fraction-scaled defaults", () => {
    const customPercents = { valuation: 50, profitability: 20, growth: 15, financial: 10, dividend: 5 };
    expect(weightsEqualDefaults(customPercents, DEFAULT_SCORING_WEIGHTS.fundamental)).toBe(false);
  });

  it("is tolerant of floating-point dust from normalization, not exact-equality fragile", () => {
    // A hand-rounded percent split whose proportions are the defaults' but
    // carries harmless float noise after division — must still compare equal.
    const noisy = {
      intrinsicValue: 25.000000001,
      fundamental: 24.999999999,
      technical: 20,
      sentiment: 15,
      analyst: 15,
    };
    expect(weightsEqualDefaults(noisy, DEFAULT_SCORING_WEIGHTS.composite)).toBe(true);
  });
});

// ADR-22 (plans/2026-07-21-scoring-weights-direct-percent.md): direct whole
// percentages summing to 100, validated at the settings boundary. The
// internal scoring scale (DEFAULT_SCORING_WEIGHTS, normalizeWeights, the two
// weighted-total functions) stays fractions and is unchanged above — these
// are pure conversion/validation helpers at the settings API boundary.

describe("fractionsToPercents", () => {
  it("converts the composite defaults to whole percents summing to exactly 100", () => {
    const result = fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite);
    expect(result).toEqual({
      intrinsicValue: 25,
      fundamental: 25,
      technical: 20,
      sentiment: 15,
      analyst: 15,
    });
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("converts the fundamental defaults to whole percents summing to exactly 100", () => {
    const result = fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental);
    expect(result).toEqual({
      valuation: 30,
      profitability: 30,
      growth: 20,
      financial: 15,
      dividend: 5,
    });
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("repairs rounding drift via largest-remainder so equal thirds sum to exactly 100 (not 99)", () => {
    const thirds = { a: 1 / 3, b: 1 / 3, c: 1 / 3 };
    const result = fractionsToPercents(thirds);
    const sum = result.a + result.b + result.c;
    expect(sum).toBe(100);
    // Naive Math.round(33.333) x 3 = 99 — largest-remainder gives the leftover
    // point to (one of) the largest-remainder buckets, e.g. 33/33/34.
    expect([result.a, result.b, result.c].sort()).toEqual([33, 33, 34]);
  });

  it("handles an arbitrary legacy raw row (non-1.0-summing input) by scaling and repairing to 100", () => {
    // A raw (un-normalized) row like the pre-ADR-22 storage format — this
    // helper is typically called on already-normalized fractions, but must
    // still produce a clean 100-sum for any positive input group.
    // Raw sums to 8: 2 + 2 + 1.6 + 1.2 + 1.2.
    const normalized = { a: 2 / 8, b: 2 / 8, c: 1.6 / 8, d: 1.2 / 8, e: 1.2 / 8 };
    const result = fractionsToPercents(normalized);
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(100);
  });

  // DP-S1 (reviews/2026-07-21-scoring-weights-direct-percent.md): the
  // negative-leftover trim branch is defensive-only for the real caller
  // (getWeightsForSettings always passes an already-normalized group summing
  // to ~1.0, so sum-of-floors can never exceed 100 there) but was previously
  // untested directly. This hand-constructs a group whose ×100 floors sum to
  // 101 (input sums to 1.055, above the ~1.0 the real caller guarantees) to
  // drive the `leftover < 0` trim loop and lock in its behavior.
  it("trims the smallest-remainder entry when sum-of-floors exceeds 100 (over-100 defensive branch)", () => {
    const overSumming = { a: 0.209, b: 0.209, c: 0.209, d: 0.209, e: 0.219 };
    // Sanity: floors are [20,20,20,20,21], summing to 101 (over 100) before repair.
    const floors = Object.values(overSumming).map((v) => Math.floor(v * 100));
    expect(floors.reduce((a, b) => a + b, 0)).toBe(101);

    const result = fractionsToPercents(overSumming);
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(100);
    // The one-point excess is trimmed from a floor-101 bucket, landing back on
    // an even split — deterministic given the smallest-remainder tie-break.
    expect(result).toEqual({ a: 20, b: 20, c: 20, d: 20, e: 20 });
  });
});

describe("percentsToFractions", () => {
  it("divides each value by 100", () => {
    const result = percentsToFractions({ a: 25, b: 25, c: 20, d: 15, e: 15 });
    expect(result).toEqual({ a: 0.25, b: 0.25, c: 0.2, d: 0.15, e: 0.15 });
  });

  it("round-trips the composite defaults through fractionsToPercents -> percentsToFractions", () => {
    const percents = fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite);
    const backToFractions = percentsToFractions(percents);
    expect(backToFractions).toEqual(DEFAULT_SCORING_WEIGHTS.composite);
  });
});

describe("sumsTo100", () => {
  it("is true for a group summing exactly to 100", () => {
    expect(sumsTo100({ a: 25, b: 25, c: 20, d: 15, e: 15 })).toBe(true);
  });

  it("is true within the default epsilon (0.01) of floating-point dust", () => {
    expect(sumsTo100({ a: 100.005, b: 0 })).toBe(true);
    expect(sumsTo100({ a: 99.995, b: 0 })).toBe(true);
  });

  it("is false when the sum is short (94)", () => {
    expect(sumsTo100({ a: 25, b: 25, c: 20, d: 15, e: 9 })).toBe(false);
  });

  it("is false when the sum is over (101)", () => {
    expect(sumsTo100({ a: 26, b: 25, c: 20, d: 15, e: 15 })).toBe(false);
  });

  it("respects a custom epsilon", () => {
    expect(sumsTo100({ a: 99 }, 2)).toBe(true);
    expect(sumsTo100({ a: 99 }, 0.5)).toBe(false);
  });
});

// Task 2 — scale-invariance regression (proves the scoring math is unchanged
// by ADR-22): a group expressed as whole percents and the identical
// proportions expressed as fractions must normalize to the same fractions
// and therefore produce byte-identical scores.
describe("scale-invariance regression (ADR-22 guard)", () => {
  it("weightedCompositeTotal is identical for a percent-scaled group vs its fraction-scaled equivalent", () => {
    const percentGroup = { intrinsicValue: 25, fundamental: 25, technical: 20, sentiment: 15, analyst: 15 };
    const fractionGroup = { intrinsicValue: 0.25, fundamental: 0.25, technical: 0.2, sentiment: 0.15, analyst: 0.15 };
    const scores = { intrinsicValue: 8, fundamental: 6, technical: 7, sentiment: 5, analyst: 9 };

    const totalFromPercents = weightedCompositeTotal(scores, normalizeCompositeWeights(percentGroup));
    const totalFromFractions = weightedCompositeTotal(scores, normalizeCompositeWeights(fractionGroup));

    expect(totalFromPercents).toBe(totalFromFractions);
  });

  it("weightedFundamentalTotal is identical for a percent-scaled group vs its fraction-scaled equivalent", () => {
    const percentGroup = { valuation: 30, profitability: 30, growth: 20, financial: 15, dividend: 5 };
    const fractionGroup = { valuation: 0.3, profitability: 0.3, growth: 0.2, financial: 0.15, dividend: 0.05 };
    const breakdown = { valuation: 7, profitability: 6, growth: 8, financial: 5, dividend: 3 };

    const totalFromPercents = weightedFundamentalTotal(breakdown, normalizeFundamentalWeights(percentGroup));
    const totalFromFractions = weightedFundamentalTotal(breakdown, normalizeFundamentalWeights(fractionGroup));

    expect(totalFromPercents).toBe(totalFromFractions);
  });

  it("an arbitrary legacy raw row scores identically to its fractionsToPercents(normalize(...)) presentation", () => {
    // A raw relative-weight row as it could exist under the pre-ADR-22 (ADR-20)
    // storage model — arbitrary positive numbers, not normalized, not percents.
    const legacyRawRow = { intrinsicValue: 2, fundamental: 2, technical: 1.6, sentiment: 1.2, analyst: 1.2 };
    const scores = { intrinsicValue: 8, fundamental: 6, technical: 7, sentiment: 5, analyst: 9 };

    // Path A: score directly off the raw row (what scoring consumers do today
    // via normalizeCompositeWeights, unchanged by this plan).
    const totalFromRaw = weightedCompositeTotal(scores, normalizeCompositeWeights(legacyRawRow));

    // Path B: what the settings page would now show for this legacy row
    // (getWeightsForSettings: normalize -> fractionsToPercents), then scored
    // as if that presented percent group were saved back and normalized again.
    const presentedPercents = fractionsToPercents(normalizeCompositeWeights(legacyRawRow));
    const totalFromPresentedPercents = weightedCompositeTotal(scores, normalizeCompositeWeights(presentedPercents));

    expect(totalFromPresentedPercents).toBe(totalFromRaw);
  });
});

// ADR-23 (plans/2026-07-21-scoring-style-presets.md): named investment-style
// presets are whole-percent settings-layer data, not a second fractions
// weights definition. Composite covers nine styles; Fundamental covers six
// (Momentum/Sentiment/Analyst Consensus are composite-only).
describe("SCORING_STYLE_PRESETS", () => {
  const COMPOSITE_KEYS: (keyof CompositeWeights)[] = [
    "intrinsicValue",
    "fundamental",
    "technical",
    "sentiment",
    "analyst",
  ];
  const FUNDAMENTAL_KEYS: (keyof FundamentalWeights)[] = [
    "valuation",
    "profitability",
    "growth",
    "financial",
    "dividend",
  ];
  const COMPOSITE_ONLY_IDS = ["momentum", "sentiment", "analyst"];
  const BOTH_GROUPS_IDS = ["value", "deep-value", "quality", "growth", "income", "balanced"];

  it("every preset's composite group sums to exactly 100", () => {
    for (const preset of SCORING_STYLE_PRESETS) {
      expect(preset.composite, `${preset.id} is missing a composite group`).toBeDefined();
      const sum = Object.values(preset.composite as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum, `${preset.id}.composite sums to ${sum}, not 100`).toBe(100);
    }
  });

  it("every preset's composite group has exactly the five expected keys", () => {
    for (const preset of SCORING_STYLE_PRESETS) {
      expect(Object.keys(preset.composite!).sort()).toEqual([...COMPOSITE_KEYS].sort());
    }
  });

  it("every preset that defines a fundamental group sums to exactly 100 with the five expected keys", () => {
    for (const preset of SCORING_STYLE_PRESETS) {
      if (preset.fundamental === undefined) continue;
      const sum = Object.values(preset.fundamental as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum, `${preset.id}.fundamental sums to ${sum}, not 100`).toBe(100);
      expect(Object.keys(preset.fundamental).sort()).toEqual([...FUNDAMENTAL_KEYS].sort());
    }
  });

  it("defines all nine expected preset ids, each with a composite group", () => {
    const ids = SCORING_STYLE_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "value",
      "deep-value",
      "quality",
      "growth",
      "momentum",
      "sentiment",
      "analyst",
      "income",
      "balanced",
    ]);
  });

  it("momentum, sentiment, and analyst define composite only (no fundamental group)", () => {
    for (const id of COMPOSITE_ONLY_IDS) {
      const preset = SCORING_STYLE_PRESETS.find((p) => p.id === id);
      expect(preset, `preset ${id} not found`).toBeDefined();
      expect(preset!.composite).toBeDefined();
      expect(preset!.fundamental).toBeUndefined();
    }
  });

  it("value, deep-value, quality, growth, income, and balanced define both groups", () => {
    for (const id of BOTH_GROUPS_IDS) {
      const preset = SCORING_STYLE_PRESETS.find((p) => p.id === id);
      expect(preset, `preset ${id} not found`).toBeDefined();
      expect(preset!.composite).toBeDefined();
      expect(preset!.fundamental).toBeDefined();
    }
  });

  it("balanced.composite deep-equals fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite), not a hand-typed literal", () => {
    const balanced = SCORING_STYLE_PRESETS.find((p) => p.id === "balanced")!;
    expect(balanced.composite).toEqual(fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite));
  });

  it("balanced.fundamental deep-equals fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental), not a hand-typed literal", () => {
    const balanced = SCORING_STYLE_PRESETS.find((p) => p.id === "balanced")!;
    expect(balanced.fundamental).toEqual(fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental));
  });
});

describe("presetsForGroup", () => {
  it("composite: returns all nine presets in authorship order", () => {
    const result = presetsForGroup("composite");
    expect(result.map((p) => p.id)).toEqual([
      "value",
      "deep-value",
      "quality",
      "growth",
      "momentum",
      "sentiment",
      "analyst",
      "income",
      "balanced",
    ]);
  });

  it("fundamental: excludes momentum, sentiment, and analyst; returns six in authorship order", () => {
    const result = presetsForGroup("fundamental");
    expect(result.map((p) => p.id)).toEqual([
      "value",
      "deep-value",
      "quality",
      "growth",
      "income",
      "balanced",
    ]);
    expect(result.some((p) => p.id === "momentum")).toBe(false);
    expect(result.some((p) => p.id === "sentiment")).toBe(false);
    expect(result.some((p) => p.id === "analyst")).toBe(false);
  });
});
