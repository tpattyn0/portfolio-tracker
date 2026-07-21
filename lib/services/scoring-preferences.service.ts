import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCORING_WEIGHTS,
  normalizeCompositeWeights,
  normalizeFundamentalWeights,
  fractionsToPercents,
  sumsTo100,
  type CompositeWeights,
  type FundamentalWeights,
} from "@/lib/utils/scoring-weights";

/**
 * Per-user scoring-weight preferences (plans/2026-07-20-configurable-scoring-weights.md,
 * ADR-20/ADR-21; direct-percent revision ADR-22,
 * plans/2026-07-21-scoring-weights-direct-percent.md). Pure business logic —
 * no auth (the route does auth, ADR-3). Reads/writes UserScoringPreferences,
 * coalescing null columns (or a missing row entirely) to DEFAULT_SCORING_WEIGHTS
 * so a user who never touches Settings sees exactly the same weights as today.
 *
 * Two accessors, deliberately different shapes (ADR-22 Assumptions — lowest-risk
 * split):
 * - `getWeights` — RAW-coalesced numbers, unchanged. Used by scoring consumers
 *   (overview.tsx, fundamental-analysis.service.ts, wishlist.service.ts), which
 *   already pipe this through normalizeCompositeWeights/normalizeFundamentalWeights.
 *   Do NOT route these consumers through the percent form.
 * - `getWeightsForSettings` — whole percents summing to 100, for the settings
 *   route only. Normalizes (so both new percent rows and legacy raw rows land
 *   on the same fractions) then converts to percents via fractionsToPercents
 *   (largest-remainder repair guarantees an exact 100 sum for any input).
 */

export interface ScoringWeights {
  composite: CompositeWeights;
  fundamental: FundamentalWeights;
}

export interface ScoringWeightsInput {
  composite?: Partial<CompositeWeights>;
  fundamental?: Partial<FundamentalWeights>;
}

/** Thrown by saveWeights when a negative or non-finite weight is supplied. */
export class InvalidScoringWeightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScoringWeightsError";
  }
}

function coalesce<K extends string>(
  row: Record<string, unknown> | null | undefined,
  columnMap: Record<K, string>,
  defaults: Record<K, number>
): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of Object.keys(defaults) as K[]) {
    const column = columnMap[key];
    const value = row?.[column];
    result[key] = typeof value === "number" ? value : defaults[key];
  }
  return result;
}

const COMPOSITE_COLUMN_MAP: Record<keyof CompositeWeights, string> = {
  intrinsicValue: "wCompositeIntrinsic",
  fundamental: "wCompositeFundamental",
  technical: "wCompositeTechnical",
  sentiment: "wCompositeSentiment",
  analyst: "wCompositeAnalyst",
};

const FUNDAMENTAL_COLUMN_MAP: Record<keyof FundamentalWeights, string> = {
  valuation: "wFundValuation",
  profitability: "wFundProfitability",
  growth: "wFundGrowth",
  financial: "wFundFinancial",
  dividend: "wFundDividend",
};

/**
 * Reads the user's raw (not normalized) scoring weights, coalescing every
 * null column — and the "no row at all" case — to DEFAULT_SCORING_WEIGHTS.
 * Normalization is a read-model concern the callers apply
 * (normalizeCompositeWeights/normalizeFundamentalWeights).
 */
export async function getWeights(userId: string): Promise<ScoringWeights> {
  const row = await prisma.userScoringPreferences.findUnique({ where: { userId } });

  return {
    composite: coalesce(row, COMPOSITE_COLUMN_MAP, DEFAULT_SCORING_WEIGHTS.composite),
    fundamental: coalesce(row, FUNDAMENTAL_COLUMN_MAP, DEFAULT_SCORING_WEIGHTS.fundamental),
  };
}

/**
 * Reads the user's scoring weights as whole percentages summing to 100 per
 * group (ADR-22) — the shape the settings page's GET consumes. Loads the same
 * defaults-coalesced row as `getWeights`, normalizes each group to sum-to-1
 * (reusing the existing, tested normalize functions), then converts to whole
 * percents via `fractionsToPercents` (largest-remainder repair guarantees an
 * exact 100 sum). This uniformly handles:
 * - a missing row / all-null columns -> defaults, presented as 25/25/20/15/15
 *   and 30/30/20/15/5 (both already clean whole numbers summing to 100)
 * - a legacy raw (ADR-20, pre-percent) row -> its normalized-to-100 percent
 *   split, which scores identically to the raw row (scale-invariance,
 *   asserted in scoring-weights.test.ts's scale-invariance regression block)
 * - a new percent-form row -> itself (normalize-then-x100 of an
 *   already-100-summing group is a no-op modulo the largest-remainder repair,
 *   which is itself a no-op for a clean whole-percent group)
 */
export async function getWeightsForSettings(userId: string): Promise<ScoringWeights> {
  const raw = await getWeights(userId);

  return {
    composite: fractionsToPercents(normalizeCompositeWeights(raw.composite)),
    fundamental: fractionsToPercents(normalizeFundamentalWeights(raw.fundamental)),
  };
}

const COMPOSITE_KEYS = Object.keys(DEFAULT_SCORING_WEIGHTS.composite) as (keyof CompositeWeights)[];
const FUNDAMENTAL_KEYS = Object.keys(DEFAULT_SCORING_WEIGHTS.fundamental) as (keyof FundamentalWeights)[];

/**
 * Validates a supplied group under the direct-percent contract (ADR-22):
 * every one of the group's keys must be present, each a finite number in
 * [0, 100], and the group must sum to 100 within epsilon. A partial group
 * (some keys missing) is rejected outright — sum-to-100 is not meaningful to
 * validate against an incomplete set, and the settings page always PUTs a
 * complete group of 5 (the old partial-merge behavior from ADR-20 is dropped).
 */
function validateGroup<K extends string>(
  group: Record<string, number> | undefined,
  groupName: string,
  keys: K[]
): void {
  if (!group) return;

  for (const key of keys) {
    const value = group[key];
    if (value === undefined) {
      throw new InvalidScoringWeightsError(`Invalid ${groupName} weights: missing "${key}"`);
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new InvalidScoringWeightsError(
        `Invalid ${groupName} weight "${key}": must be a finite number in [0, 100]`
      );
    }
  }

  const complete = {} as Record<K, number>;
  for (const key of keys) complete[key] = group[key];
  if (!sumsTo100(complete)) {
    const sum = keys.reduce((acc, key) => acc + group[key], 0);
    throw new InvalidScoringWeightsError(
      `Invalid ${groupName} weights: must sum to 100 (got ${sum})`
    );
  }
}

/**
 * Validates and upserts the user's scoring weights as whole percentages
 * (ADR-22). Each supplied group (composite and/or fundamental) must have all
 * five keys present, each in [0, 100], summing to 100 within epsilon —
 * otherwise throws `InvalidScoringWeightsError` (the route maps this to a
 * 400). Stores the percents as given in the same `Float` columns (no schema
 * change — only the stored number's meaning/scale changed). Returns the
 * saved, defaults-coalesced set (same shape/scale as getWeights — i.e. the
 * raw percent numbers just stored, not re-normalized).
 */
export async function saveWeights(userId: string, input: ScoringWeightsInput): Promise<ScoringWeights> {
  validateGroup(input.composite, "composite", COMPOSITE_KEYS);
  validateGroup(input.fundamental, "fundamental", FUNDAMENTAL_KEYS);

  const data: Record<string, number> = {};
  if (input.composite) {
    for (const [key, value] of Object.entries(input.composite)) {
      if (value === undefined) continue;
      data[COMPOSITE_COLUMN_MAP[key as keyof CompositeWeights]] = value;
    }
  }
  if (input.fundamental) {
    for (const [key, value] of Object.entries(input.fundamental)) {
      if (value === undefined) continue;
      data[FUNDAMENTAL_COLUMN_MAP[key as keyof FundamentalWeights]] = value;
    }
  }

  await prisma.userScoringPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return getWeights(userId);
}
