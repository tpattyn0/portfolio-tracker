import { prisma } from "@/lib/prisma";
import { DEFAULT_SCORING_WEIGHTS, type CompositeWeights, type FundamentalWeights } from "@/lib/utils/scoring-weights";

/**
 * Per-user scoring-weight preferences (plans/2026-07-20-configurable-scoring-weights.md,
 * ADR-20/ADR-21). Pure business logic — no auth (the route does auth, ADR-3).
 * Reads/writes UserScoringPreferences, coalescing null columns (or a missing
 * row entirely) to DEFAULT_SCORING_WEIGHTS so a user who never touches
 * Settings sees exactly the same weights as today.
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

function validateGroup(group: Record<string, number> | undefined, groupName: string): void {
  if (!group) return;
  for (const [key, value] of Object.entries(group)) {
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new InvalidScoringWeightsError(
        `Invalid ${groupName} weight "${key}": must be a non-negative finite number`
      );
    }
  }
}

/**
 * Validates and upserts the user's raw scoring weights. Rejects any negative
 * or non-finite number (the route surfaces this as a 400). An all-zero group
 * is accepted — normalizeWeights handles that as "fall back to defaults" at
 * read time, not a write-time concern. Returns the saved, defaults-coalesced
 * set (same shape as getWeights).
 */
export async function saveWeights(userId: string, input: ScoringWeightsInput): Promise<ScoringWeights> {
  validateGroup(input.composite, "composite");
  validateGroup(input.fundamental, "fundamental");

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
