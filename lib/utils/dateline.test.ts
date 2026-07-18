import { describe, expect, it } from "vitest";
import { formatDateline, toRoman } from "./dateline";

describe("toRoman", () => {
  it("converts known values", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(26)).toBe("XXVI");
    expect(toRoman(40)).toBe("XL");
    expect(toRoman(99)).toBe("XCIX");
    expect(toRoman(2026)).toBe("MMXXVI");
  });

  it("returns an empty string for non-positive or non-finite input", () => {
    expect(toRoman(0)).toBe("");
    expect(toRoman(-5)).toBe("");
    expect(toRoman(NaN)).toBe("");
    expect(toRoman(Infinity)).toBe("");
  });

  it("returns an empty string for non-integer input", () => {
    expect(toRoman(3.5)).toBe("");
  });
});

describe("formatDateline", () => {
  it("matches the owner-specified example for 17 July 2026", () => {
    // 2026 -> two-digit year 26 -> XXVI; day-of-year for 17 July 2026 is 198.
    const date = new Date(2026, 6, 17); // month is 0-indexed
    expect(formatDateline(date)).toBe(
      "Vol. XXVI — № 198 · Friday, 17 July 2026"
    );
  });

  it("computes a different volume/issue for a different date", () => {
    const date = new Date(2025, 0, 1); // 1 Jan 2025 -> day-of-year 1
    expect(formatDateline(date)).toBe(
      "Vol. XXV — № 1 · Wednesday, 1 January 2025"
    );
  });
});
