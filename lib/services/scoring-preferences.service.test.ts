import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/utils/scoring-weights";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userScoringPreferences: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

import { getWeights, saveWeights, InvalidScoringWeightsError } from "./scoring-preferences.service";

describe("getWeights", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("returns all-defaults when the user has no row", async () => {
    findUnique.mockResolvedValueOnce(null);
    const result = await getWeights("user-1");
    expect(result).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it("coalesces null columns to defaults while preserving set values", async () => {
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 0.5,
      wCompositeFundamental: null,
      wCompositeTechnical: null,
      wCompositeSentiment: null,
      wCompositeAnalyst: null,
      wFundValuation: null,
      wFundProfitability: 0.6,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    const result = await getWeights("user-1");

    expect(result.composite.intrinsicValue).toBe(0.5);
    expect(result.composite.fundamental).toBe(DEFAULT_SCORING_WEIGHTS.composite.fundamental);
    expect(result.composite.technical).toBe(DEFAULT_SCORING_WEIGHTS.composite.technical);

    expect(result.fundamental.profitability).toBe(0.6);
    expect(result.fundamental.valuation).toBe(DEFAULT_SCORING_WEIGHTS.fundamental.valuation);
  });

  it("a fully-populated row is returned as-is (no defaults substituted)", async () => {
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 1,
      wCompositeFundamental: 2,
      wCompositeTechnical: 3,
      wCompositeSentiment: 4,
      wCompositeAnalyst: 5,
      wFundValuation: 6,
      wFundProfitability: 7,
      wFundGrowth: 8,
      wFundFinancial: 9,
      wFundDividend: 10,
    });

    const result = await getWeights("user-1");
    expect(result.composite).toEqual({
      intrinsicValue: 1,
      fundamental: 2,
      technical: 3,
      sentiment: 4,
      analyst: 5,
    });
    expect(result.fundamental).toEqual({
      valuation: 6,
      profitability: 7,
      growth: 8,
      financial: 9,
      dividend: 10,
    });
  });
});

describe("saveWeights", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("upserts on userId with the provided fields mapped to their DB columns", async () => {
    upsert.mockResolvedValueOnce({});
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 2,
      wCompositeFundamental: null,
      wCompositeTechnical: null,
      wCompositeSentiment: null,
      wCompositeAnalyst: null,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    await saveWeights("user-1", { composite: { intrinsicValue: 2 } });

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-1" });
    expect(call.create).toMatchObject({ userId: "user-1", wCompositeIntrinsic: 2 });
    expect(call.update).toMatchObject({ wCompositeIntrinsic: 2 });
  });

  it("returns the saved+defaulted set (re-reads via getWeights)", async () => {
    upsert.mockResolvedValueOnce({});
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 3,
      wCompositeFundamental: null,
      wCompositeTechnical: null,
      wCompositeSentiment: null,
      wCompositeAnalyst: null,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    const result = await saveWeights("user-1", { composite: { intrinsicValue: 3 } });
    expect(result.composite.intrinsicValue).toBe(3);
    expect(result.composite.fundamental).toBe(DEFAULT_SCORING_WEIGHTS.composite.fundamental);
  });

  it("accepts an all-zero group (normalizer handles it at read time, not a write-time concern)", async () => {
    upsert.mockResolvedValueOnce({});
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 0,
      wCompositeFundamental: 0,
      wCompositeTechnical: 0,
      wCompositeSentiment: 0,
      wCompositeAnalyst: 0,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    await expect(
      saveWeights("user-1", {
        composite: { intrinsicValue: 0, fundamental: 0, technical: 0, sentiment: 0, analyst: 0 },
      })
    ).resolves.toBeTruthy();
  });

  it("rejects a negative weight", async () => {
    await expect(saveWeights("user-1", { composite: { intrinsicValue: -1 } })).rejects.toBeInstanceOf(
      InvalidScoringWeightsError
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-finite (NaN/Infinity) weight", async () => {
    await expect(saveWeights("user-1", { fundamental: { valuation: NaN } })).rejects.toBeInstanceOf(
      InvalidScoringWeightsError
    );
    await expect(saveWeights("user-1", { fundamental: { valuation: Infinity } })).rejects.toBeInstanceOf(
      InvalidScoringWeightsError
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
