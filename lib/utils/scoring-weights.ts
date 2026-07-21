/**
 * Single source of truth for scoring-weight math (plans/2026-07-20-configurable-scoring-weights.md,
 * ADR-20/ADR-21). Pure module — no React, no DB, no I/O. Consumed by:
 * - `components/overview.tsx` (client composite recompute)
 * - `components/fundamental-analysis.tsx` (custom-weighting meta kicker comparison)
 * - `lib/services/fundamental-analysis.service.ts` (server fundamental reweight, on read only)
 * - `lib/services/scoring-preferences.service.ts` (default-coalescing)
 * - `lib/services/wishlist.service.ts` (Task 8 — the wishlist must not keep its own copy)
 *
 * DEFAULT_SCORING_WEIGHTS is verified against the pre-existing hardcoded values:
 * composite from components/overview.tsx (intrinsicValue 0.25, fundamental 0.25,
 * technical 0.20, sentiment 0.15, analyst 0.15) and fundamental from
 * lib/services/fundamental-analysis.service.ts (valuation 0.3, profitability 0.3,
 * growth 0.2, financial 0.15, dividend 0.05). A user with no UserScoringPreferences
 * row scores byte-identically to today because both groups already sum to 1.0.
 */

export interface CompositeWeights {
  intrinsicValue: number;
  fundamental: number;
  technical: number;
  sentiment: number;
  analyst: number;
}

export interface FundamentalWeights {
  valuation: number;
  profitability: number;
  growth: number;
  financial: number;
  dividend: number;
}

export const DEFAULT_SCORING_WEIGHTS: { composite: CompositeWeights; fundamental: FundamentalWeights } = {
  composite: {
    intrinsicValue: 0.25,
    fundamental: 0.25,
    technical: 0.2,
    sentiment: 0.15,
    analyst: 0.15,
  },
  fundamental: {
    valuation: 0.3,
    profitability: 0.3,
    growth: 0.2,
    financial: 0.15,
    dividend: 0.05,
  },
};

export interface CompositeScores {
  intrinsicValue: number | null | undefined;
  fundamental: number | null | undefined;
  technical: number | null | undefined;
  sentiment: number | null | undefined;
  analyst: number | null | undefined;
}

export interface FundamentalBreakdown {
  valuation: number;
  profitability: number;
  growth: number;
  financial: number;
  dividend: number;
}

/**
 * Normalizes a group of raw relative weights so it sums to 1.0.
 *
 * Contract (ADR-20):
 * - Negative inputs are clamped to 0 before summing (defensive — the API also
 *   rejects negatives at write time).
 * - An all-zero (or all-negative-clamped-to-zero) group falls back to that
 *   group's own `defaults` — never equal weights, which would silently change
 *   a user's scores to a distribution they never chose.
 * - A single non-zero weight yields 1.0 for that dimension, 0.0 for the rest.
 * - The normal case divides each weight by the group sum.
 *
 * Generic over any fixed-shape weight record so it works for both the
 * 5-key composite group and the 5-key fundamental group.
 */
export function normalizeWeights<K extends string>(
  raw: Record<K, number>,
  defaults: Record<K, number>
): Record<K, number> {
  const keys = Object.keys(defaults) as K[];

  const clamped = {} as Record<K, number>;
  let sum = 0;
  for (const key of keys) {
    const value = raw[key];
    const safe = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
    clamped[key] = safe;
    sum += safe;
  }

  if (sum <= 0) {
    // All-zero (or all-negative-clamped) group — fall back to the curated
    // defaults rather than equal weights (ADR-20).
    const result = {} as Record<K, number>;
    for (const key of keys) result[key] = defaults[key];
    return result;
  }

  const result = {} as Record<K, number>;
  for (const key of keys) {
    result[key] = clamped[key] / sum;
  }
  return result;
}

/** Normalizes a composite weight group, defaulting to DEFAULT_SCORING_WEIGHTS.composite. */
export function normalizeCompositeWeights(raw: Partial<CompositeWeights> | null | undefined): CompositeWeights {
  const merged: CompositeWeights = { ...DEFAULT_SCORING_WEIGHTS.composite, ...(raw ?? {}) };
  return normalizeWeights(merged, DEFAULT_SCORING_WEIGHTS.composite);
}

/** Normalizes a fundamental weight group, defaulting to DEFAULT_SCORING_WEIGHTS.fundamental. */
export function normalizeFundamentalWeights(raw: Partial<FundamentalWeights> | null | undefined): FundamentalWeights {
  const merged: FundamentalWeights = { ...DEFAULT_SCORING_WEIGHTS.fundamental, ...(raw ?? {}) };
  return normalizeWeights(merged, DEFAULT_SCORING_WEIGHTS.fundamental);
}

/**
 * Weighted composite total (0-10) from the five research dimension scores.
 * A missing (`null`/`undefined`) dimension substitutes a neutral 5, matching
 * the pre-existing overview.tsx/wishlist.service.ts fallback behavior exactly.
 * `weights` must already be normalized (sum to 1.0) — callers pass
 * `normalizeCompositeWeights(prefs.composite)`.
 */
export function weightedCompositeTotal(scores: CompositeScores, weights: CompositeWeights): number {
  const sum =
    (scores.intrinsicValue ?? 5) * weights.intrinsicValue +
    (scores.fundamental ?? 5) * weights.fundamental +
    (scores.technical ?? 5) * weights.technical +
    (scores.sentiment ?? 5) * weights.sentiment +
    (scores.analyst ?? 5) * weights.analyst;
  return Math.round(sum * 10) / 10;
}

/**
 * Weighted fundamental total (0-10) from the five subcategory breakdown
 * scores. `weights` must already be normalized (sum to 1.0) — callers pass
 * `normalizeFundamentalWeights(prefs.fundamental)`. Dividing by the weight
 * sum (which is 1.0 for normalized weights) preserves the existing service's
 * shape exactly, so default weights reproduce the current total unchanged.
 */
export function weightedFundamentalTotal(breakdown: FundamentalBreakdown, weights: FundamentalWeights): number {
  const weightSum =
    weights.valuation + weights.profitability + weights.growth + weights.financial + weights.dividend;
  if (weightSum <= 0) {
    // Defensive: normalizeWeights never returns an all-zero group (it falls
    // back to defaults), but guard division-by-zero if a caller passes raw,
    // un-normalized weights directly.
    return 0;
  }
  const sum =
    breakdown.valuation * weights.valuation +
    breakdown.profitability * weights.profitability +
    breakdown.growth * weights.growth +
    breakdown.financial * weights.financial +
    breakdown.dividend * weights.dividend;
  return sum / weightSum;
}

/**
 * Scale-invariant, epsilon-tolerant comparison of a weight group against
 * defaults — powers the "Your weighting" meta kicker (`overview.tsx`,
 * `fundamental-analysis.tsx`).
 *
 * As of ADR-22, `GET /api/settings/scoring-weights` returns whole percentages
 * summing to 100 (`getWeightsForSettings`), while `DEFAULT_SCORING_WEIGHTS`
 * stays fraction-scaled (the internal scoring scale) — so `weights` and
 * `defaults` can legitimately arrive in different scales. Comparing them by
 * exact `===` on raw numbers (the pre-ADR-22 behavior, safe only because both
 * sides were fractions then) would treat every default-weights user's percent
 * group `{25,25,20,15,15}` as "custom" vs. the fraction defaults
 * `{0.25,...}` — this was DP-I1. Normalizing both sides to fractions (divide
 * by each side's own group sum) before comparing makes the check
 * scale-agnostic, matching the same scale-invariance the scoring math itself
 * relies on (`normalizeWeights`). Floating-point division requires a small
 * epsilon rather than exact equality.
 */
export function weightsEqualDefaults<K extends string>(
  weights: Record<K, number> | null | undefined,
  defaults: Record<K, number>,
  epsilon = 1e-9
): boolean {
  if (!weights) return true;
  const keys = Object.keys(defaults) as K[];

  const normalize = (group: Record<K, number>): Record<K, number> => {
    const sum = keys.reduce((total, key) => total + (Number.isFinite(group[key]) ? group[key] : 0), 0);
    const result = {} as Record<K, number>;
    for (const key of keys) {
      result[key] = sum > 0 && Number.isFinite(group[key]) ? group[key] / sum : 0;
    }
    return result;
  };

  const normalizedWeights = normalize(weights);
  const normalizedDefaults = normalize(defaults);

  return keys.every((key) => Math.abs(normalizedWeights[key] - normalizedDefaults[key]) <= epsilon);
}

/**
 * Converts a group of fractions (assumed to already sum to ~1.0, e.g. the
 * output of normalizeCompositeWeights/normalizeFundamentalWeights) into whole
 * percentages that sum to EXACTLY 100 (ADR-22, plans/2026-07-21-scoring-weights-direct-percent.md).
 *
 * Naive `Math.round(fraction * 100)` per key can drift off 100 due to rounding
 * (e.g. three even thirds round to 33/33/33 = 99). This applies the
 * "largest remainder" method: round every value down, then distribute the
 * leftover percentage points (100 - sum-of-floors) one at a time to the
 * entries with the largest fractional remainder — the standard apportionment
 * fix for exactly this class of rounding drift.
 *
 * Pure conversion — does not touch the internal fraction-based scoring scale
 * (DEFAULT_SCORING_WEIGHTS stays fractions) or any of normalizeWeights /
 * weightedCompositeTotal / weightedFundamentalTotal.
 */
export function fractionsToPercents<K extends string>(weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];

  const scaled = keys.map((key) => {
    const raw = weights[key] * 100;
    const safe = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const floor = Math.floor(safe);
    return { key, floor, remainder: safe - floor };
  });

  const flooredSum = scaled.reduce((sum, s) => sum + s.floor, 0);
  let leftover = Math.round(100 - flooredSum);

  // Largest remainder first; ties broken by original key order (stable sort).
  const byRemainderDesc = [...scaled].sort((a, b) => b.remainder - a.remainder);

  const result = {} as Record<K, number>;
  for (const s of scaled) result[s.key] = s.floor;

  for (let i = 0; i < byRemainderDesc.length && leftover > 0; i++, leftover--) {
    result[byRemainderDesc[i].key] += 1;
  }
  // Defensive: if leftover is somehow negative (shouldn't happen for a group
  // that summed to ~1.0 pre-scaling), trim from the smallest remainders last.
  for (let i = byRemainderDesc.length - 1; i >= 0 && leftover < 0; i--, leftover++) {
    result[byRemainderDesc[i].key] = Math.max(0, result[byRemainderDesc[i].key] - 1);
  }

  return result;
}

/** Converts a group of whole percentages (0-100) back to fractions (÷100). */
export function percentsToFractions<K extends string>(percents: Record<K, number>): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of Object.keys(percents) as K[]) {
    result[key] = percents[key] / 100;
  }
  return result;
}

/**
 * Validation predicate for the direct-percent settings UX (ADR-22): does this
 * group's values sum to 100 within `epsilon`? Whole-percent inputs summing to
 * 100 sum cleanly — the epsilon only guards floating-point dust (e.g. from
 * repeated ÷100/×100 round-trips), not real drift.
 */
export function sumsTo100<K extends string>(weights: Record<K, number>, epsilon = 0.01): boolean {
  const sum = Object.values(weights as Record<string, number>).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) <= epsilon;
}
