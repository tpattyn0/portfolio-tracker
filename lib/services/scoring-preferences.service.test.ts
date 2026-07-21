import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_SCORING_WEIGHTS, fractionsToPercents } from "@/lib/utils/scoring-weights";

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

import {
  getWeights,
  getWeightsForSettings,
  saveWeights,
  InvalidScoringWeightsError,
} from "./scoring-preferences.service";

const COMPLETE_COMPOSITE = { intrinsicValue: 25, fundamental: 25, technical: 20, sentiment: 15, analyst: 15 };
const COMPLETE_FUNDAMENTAL = { valuation: 30, profitability: 30, growth: 20, financial: 15, dividend: 5 };

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

describe("getWeightsForSettings", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("returns defaults-as-percents summing to 100 for a missing row", async () => {
    findUnique.mockResolvedValueOnce(null);
    const result = await getWeightsForSettings("user-1");

    expect(result.composite).toEqual(fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite));
    expect(result.fundamental).toEqual(fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental));
    expect(Object.values(result.composite).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(result.fundamental).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("returns a legacy raw row's normalized-% split, summing to exactly 100", async () => {
    // A raw (un-normalized, pre-ADR-22) row — arbitrary positive numbers, not
    // percents, not summing to 1.0 or 100.
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 2,
      wCompositeFundamental: 2,
      wCompositeTechnical: 1.6,
      wCompositeSentiment: 1.2,
      wCompositeAnalyst: 1.2,
      wFundValuation: 6,
      wFundProfitability: 6,
      wFundGrowth: 4,
      wFundFinancial: 3,
      wFundDividend: 1,
    });

    const result = await getWeightsForSettings("user-1");

    expect(Object.values(result.composite).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(result.fundamental).reduce((a, b) => a + b, 0)).toBe(100);
    // Every value is a whole number.
    for (const v of Object.values(result.composite)) expect(Number.isInteger(v)).toBe(true);
  });

  it("a valid percent-form row (already summing to 100) round-trips through unchanged", async () => {
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 25,
      wCompositeFundamental: 25,
      wCompositeTechnical: 20,
      wCompositeSentiment: 15,
      wCompositeAnalyst: 15,
      wFundValuation: 30,
      wFundProfitability: 30,
      wFundGrowth: 20,
      wFundFinancial: 15,
      wFundDividend: 5,
    });

    const result = await getWeightsForSettings("user-1");
    expect(result.composite).toEqual(COMPLETE_COMPOSITE);
    expect(result.fundamental).toEqual(COMPLETE_FUNDAMENTAL);
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
      wCompositeIntrinsic: 25,
      wCompositeFundamental: 25,
      wCompositeTechnical: 20,
      wCompositeSentiment: 15,
      wCompositeAnalyst: 15,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    await saveWeights("user-1", { composite: COMPLETE_COMPOSITE });

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-1" });
    expect(call.create).toMatchObject({ userId: "user-1", wCompositeIntrinsic: 25 });
    expect(call.update).toMatchObject({ wCompositeIntrinsic: 25 });
  });

  it("returns the saved set (re-reads via getWeights)", async () => {
    upsert.mockResolvedValueOnce({});
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 25,
      wCompositeFundamental: 25,
      wCompositeTechnical: 20,
      wCompositeSentiment: 15,
      wCompositeAnalyst: 15,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    const result = await saveWeights("user-1", { composite: COMPLETE_COMPOSITE });
    expect(result.composite).toEqual(COMPLETE_COMPOSITE);
    expect(result.fundamental).toEqual(DEFAULT_SCORING_WEIGHTS.fundamental);
  });

  it("accepts a valid complete group summing to 100", async () => {
    upsert.mockResolvedValueOnce({});
    findUnique.mockResolvedValueOnce({
      wCompositeIntrinsic: 25,
      wCompositeFundamental: 25,
      wCompositeTechnical: 20,
      wCompositeSentiment: 15,
      wCompositeAnalyst: 15,
      wFundValuation: null,
      wFundProfitability: null,
      wFundGrowth: null,
      wFundFinancial: null,
      wFundDividend: null,
    });

    await expect(saveWeights("user-1", { composite: COMPLETE_COMPOSITE })).resolves.toBeTruthy();
  });

  it("rejects a group summing to 94 (short of 100)", async () => {
    const short = { ...COMPLETE_COMPOSITE, analyst: 9 }; // sums to 94
    await expect(saveWeights("user-1", { composite: short })).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a group summing to 101 (over 100)", async () => {
    const over = { ...COMPLETE_COMPOSITE, analyst: 16 }; // sums to 101
    await expect(saveWeights("user-1", { composite: over })).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a value of -1 (out of [0,100] range)", async () => {
    const negative = { ...COMPLETE_COMPOSITE, intrinsicValue: -1, analyst: 16 }; // still sums to 100 to isolate the range check
    await expect(saveWeights("user-1", { composite: negative })).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a value of 101 (out of [0,100] range)", async () => {
    const over101 = { ...COMPLETE_COMPOSITE, intrinsicValue: -1, technical: 121 }; // sums to 100, isolates range check
    await expect(saveWeights("user-1", { composite: over101 })).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a group missing a key (partial group)", async () => {
    const { analyst, ...partial } = COMPLETE_COMPOSITE;
    void analyst;
    await expect(saveWeights("user-1", { composite: partial })).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-finite (NaN/Infinity) weight", async () => {
    await expect(
      saveWeights("user-1", { fundamental: { ...COMPLETE_FUNDAMENTAL, valuation: NaN } })
    ).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    await expect(
      saveWeights("user-1", { fundamental: { ...COMPLETE_FUNDAMENTAL, valuation: Infinity } })
    ).rejects.toBeInstanceOf(InvalidScoringWeightsError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
