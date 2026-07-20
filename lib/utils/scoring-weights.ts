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

/** Deep-equal comparison of a weight group against defaults — powers the "Your weighting" meta kicker. */
export function weightsEqualDefaults<K extends string>(
  weights: Record<K, number> | null | undefined,
  defaults: Record<K, number>
): boolean {
  if (!weights) return true;
  const keys = Object.keys(defaults) as K[];
  return keys.every((key) => weights[key] === defaults[key]);
}
