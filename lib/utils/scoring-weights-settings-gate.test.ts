import { describe, it, expect } from "vitest";
import { computeGroupTotalState, toNumbers } from "./scoring-weights-settings-gate";

/**
 * Task 6 (plans/2026-07-21-scoring-weights-direct-percent.md): the settings
 * page has no existing React/DOM component-test seam
 * (@testing-library/react is not installed in this repo), so per the plan's
 * fallback this exercises the extracted pure total/validity/save-gate helper
 * directly — the same logic the page's Save-disabled/enabled state and
 * running-total status line are driven by.
 */

const KEYS = ["a", "b", "c", "d", "e"] as const;
type Key = (typeof KEYS)[number];

function inputs(values: Record<Key, string>) {
  return values;
}

describe("toNumbers", () => {
  it("parses valid numeric strings", () => {
    expect(toNumbers({ a: "25", b: "10.5" })).toEqual({ a: 25, b: 10.5 });
  });

  it("coerces a comma decimal separator", () => {
    expect(toNumbers({ a: "12,5" })).toEqual({ a: 12.5 });
  });

  it("coerces unparseable input to 0", () => {
    expect(toNumbers({ a: "not a number", b: "" })).toEqual({ a: 0, b: 0 });
  });
});

describe("computeGroupTotalState", () => {
  const saved = inputs({ a: "25", b: "25", c: "20", d: "15", e: "15" });

  it("Save is disabled when the group total is short of 100 (94)", () => {
    const current = inputs({ a: "25", b: "25", c: "20", d: "15", e: "9" }); // sums to 94
    const state = computeGroupTotalState(current, saved, [...KEYS]);
    expect(state.total).toBe(94);
    expect(state.isValid).toBe(false);
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(false);
  });

  it("Save is disabled when the group total is over 100 (101)", () => {
    const current = inputs({ a: "26", b: "25", c: "20", d: "15", e: "15" }); // sums to 101
    const state = computeGroupTotalState(current, saved, [...KEYS]);
    expect(state.total).toBe(101);
    expect(state.isValid).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("Save is enabled at exactly 100 when dirty", () => {
    const current = inputs({ a: "30", b: "20", c: "20", d: "15", e: "15" }); // sums to 100, differs from saved
    const state = computeGroupTotalState(current, saved, [...KEYS]);
    expect(state.total).toBe(100);
    expect(state.isValid).toBe(true);
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(true);
  });

  it("Save stays disabled at exactly 100 when NOT dirty (pristine, nothing to save)", () => {
    const state = computeGroupTotalState(saved, saved, [...KEYS]);
    expect(state.isValid).toBe(true);
    expect(state.isDirty).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("the running total reflects the summed current inputs, not the saved ones", () => {
    const current = inputs({ a: "10", b: "10", c: "10", d: "10", e: "10" }); // sums to 50
    const state = computeGroupTotalState(current, saved, [...KEYS]);
    expect(state.total).toBe(50);
  });

  it("Reset yields a 100-sum split that is valid and (if it differs from saved) dirty", () => {
    // Simulates clicking "Reset to house defaults" when the saved values were
    // a custom, non-default split.
    const customSaved = inputs({ a: "10", b: "10", c: "10", d: "10", e: "60" });
    const resetToDefaults = inputs({ a: "25", b: "25", c: "20", d: "15", e: "15" });
    const state = computeGroupTotalState(resetToDefaults, customSaved, [...KEYS]);
    expect(state.total).toBe(100);
    expect(state.isValid).toBe(true);
    expect(state.isDirty).toBe(true);
    expect(state.canSave).toBe(true);
  });
});
