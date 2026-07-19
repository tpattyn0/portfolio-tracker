import { describe, expect, it } from "vitest";
import { getPositionsPanelState, shouldShowPositionsTab } from "./positions-tab";

describe("shouldShowPositionsTab", () => {
  it("returns true when transactions exist (happy path)", () => {
    expect(shouldShowPositionsTab([{ id: "tx-1" }])).toBe(true);
    expect(shouldShowPositionsTab([{ id: "tx-1" }, { id: "tx-2" }])).toBe(true);
  });

  it("returns false for an empty transactions array", () => {
    expect(shouldShowPositionsTab([])).toBe(false);
  });

  it("returns false for null/undefined (query not yet loaded)", () => {
    expect(shouldShowPositionsTab(null)).toBe(false);
    expect(shouldShowPositionsTab(undefined)).toBe(false);
  });
});

describe("getPositionsPanelState", () => {
  it("returns 'held' when a position exists with quantity > 0 (happy path)", () => {
    expect(getPositionsPanelState({ quantity: 10 })).toBe("held");
    expect(getPositionsPanelState({ quantity: 0.5 })).toBe("held");
  });

  it("returns 'closed' when a position exists but quantity is 0 — the crux edge case", () => {
    expect(getPositionsPanelState({ quantity: 0 })).toBe("closed");
  });

  it("returns 'none' when there is no position record at all", () => {
    expect(getPositionsPanelState(null)).toBe("none");
    expect(getPositionsPanelState(undefined)).toBe("none");
  });
});
