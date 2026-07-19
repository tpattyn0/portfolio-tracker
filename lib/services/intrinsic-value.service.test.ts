import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * plans/2026-07-19-research-tab-fixes.md Task 6 (OD-2 resolved — method
 * spread): after computing the 5 valuation methods, calculateIntrinsicValue
 * also derives scenarioLow/scenarioHigh (min/max of methods with a valid
 * positive value) alongside the existing weighted-average intrinsicValue
 * (unaffected — stays the Base case). scenarioLow/scenarioHigh are null when
 * fewer than 2 methods produce a valid value. No live Yahoo/DB — @/lib/prisma
 * is mocked with FundamentalData/IndustryComparison rows fabricated per case.
 */

const { findUniqueFundamentalMock, findUniqueIndustryMock } = vi.hoisted(() => ({
  findUniqueFundamentalMock: vi.fn(),
  findUniqueIndustryMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fundamentalData: { findUnique: findUniqueFundamentalMock },
    industryComparison: { findUnique: findUniqueIndustryMock },
  },
}));

import { IntrinsicValueService } from "./intrinsic-value.service";

describe("IntrinsicValueService.calculateIntrinsicValue — scenario low/high (OD-2 method spread)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueIndustryMock.mockResolvedValue(null); // methods fall back to hardcoded industry defaults
  });

  it("returns scenarioLow < intrinsicValue < scenarioHigh when several methods produce valid values", async () => {
    // A well-covered symbol: eps, bookValue, pegRatio, peRatio all present so
    // DCF Lite, Graham Number, PEG Adjusted, P/E Multiple, and P/B Multiple
    // all resolve to a value > 0 — 5 valid methods.
    findUniqueFundamentalMock.mockResolvedValueOnce({
      symbol: "AAPL",
      eps: 6,
      bookValue: 4,
      peRatio: 28,
      pegRatio: 2,
      earningsGrowth: 0.1,
    });

    const result = await IntrinsicValueService.calculateIntrinsicValue("AAPL", 190);

    expect(result.validMethodCount).toBeGreaterThanOrEqual(2);
    expect(result.scenarioLow).not.toBeNull();
    expect(result.scenarioHigh).not.toBeNull();
    expect(result.scenarioLow as number).toBeLessThanOrEqual(result.intrinsicValue as number);
    expect(result.scenarioHigh as number).toBeGreaterThanOrEqual(result.intrinsicValue as number);
    expect(result.scenarioLow as number).toBeLessThanOrEqual(result.scenarioHigh as number);
  });

  it("returns null scenarioLow/scenarioHigh when fewer than 2 methods produce a valid value", async () => {
    // Only eps present (no bookValue, no pegRatio) — DCF Lite and P/E
    // Multiple can resolve, Graham Number/PEG Adjusted/P/B Multiple cannot.
    // Force down to <2 valid methods by also omitting eps so nothing
    // computes a positive value.
    findUniqueFundamentalMock.mockResolvedValueOnce({
      symbol: "THINCOVERAGE",
      eps: null,
      bookValue: null,
      peRatio: null,
      pegRatio: null,
      earningsGrowth: null,
    });

    const result = await IntrinsicValueService.calculateIntrinsicValue("THINCOVERAGE", 50);

    expect(result.validMethodCount).toBeLessThan(2);
    expect(result.scenarioLow).toBeNull();
    expect(result.scenarioHigh).toBeNull();
    // Base case is unaffected by scenario-range insufficiency — it still
    // reports whatever the weighted average produces (possibly null too,
    // but derived independently of the scenario range).
  });

  it("throws the sentinel error when no FundamentalData row exists (route maps this to 200 unavailable)", async () => {
    findUniqueFundamentalMock.mockResolvedValueOnce(null);

    await expect(IntrinsicValueService.calculateIntrinsicValue("NODATA", 100)).rejects.toThrow(
      "No fundamental data available"
    );
  });
});
