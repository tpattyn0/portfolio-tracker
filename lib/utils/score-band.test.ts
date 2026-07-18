import { describe, expect, it } from "vitest";
import { gradingDotClass, metricGrade, scoreBand, scoreBandClass } from "./score-band";

describe("scoreBandClass", () => {
  it("bands the up/amber/dn boundaries exactly per DESIGN.md thresholds", () => {
    expect(scoreBandClass(7.0)).toBe("text-up");
    expect(scoreBandClass(6.9)).toBe("text-amber");
    expect(scoreBandClass(4.0)).toBe("text-amber");
    expect(scoreBandClass(3.9)).toBe("text-dn");
  });

  it("handles high/low extremes", () => {
    expect(scoreBandClass(10)).toBe("text-up");
    expect(scoreBandClass(0)).toBe("text-dn");
  });

  it("returns muted for null, undefined, and NaN", () => {
    expect(scoreBandClass(null)).toBe("text-mut");
    expect(scoreBandClass(undefined)).toBe("text-mut");
    expect(scoreBandClass(NaN)).toBe("text-mut");
  });
});

describe("scoreBand", () => {
  it("returns the raw band token", () => {
    expect(scoreBand(8)).toBe("up");
    expect(scoreBand(5)).toBe("amber");
    expect(scoreBand(1)).toBe("dn");
    expect(scoreBand(null)).toBe("mut");
  });
});

describe("gradingDotClass", () => {
  it("maps each grade to its band color", () => {
    expect(gradingDotClass("strong")).toBe("text-up");
    expect(gradingDotClass("inline")).toBe("text-amber");
    expect(gradingDotClass("weak")).toBe("text-dn");
    expect(gradingDotClass(null)).toBe("text-mut");
  });
});

describe("metricGrade", () => {
  it("grades higher-is-better metrics (inverse=false, the default)", () => {
    expect(metricGrade(20, { goodThreshold: 15, badThreshold: 5 })).toBe("strong");
    expect(metricGrade(10, { goodThreshold: 15, badThreshold: 5 })).toBe("inline");
    expect(metricGrade(3, { goodThreshold: 15, badThreshold: 5 })).toBe("weak");
  });

  it("grades lower-is-better metrics (inverse=true)", () => {
    // e.g. P/E ratio: <=20 good, >=30 bad.
    expect(metricGrade(15, { goodThreshold: 20, badThreshold: 30, inverse: true })).toBe("strong");
    expect(metricGrade(25, { goodThreshold: 20, badThreshold: 30, inverse: true })).toBe("inline");
    expect(metricGrade(35, { goodThreshold: 20, badThreshold: 30, inverse: true })).toBe("weak");
  });

  it("treats the threshold boundary itself as satisfying the threshold", () => {
    expect(metricGrade(20, { goodThreshold: 20, badThreshold: 30, inverse: true })).toBe("strong");
    expect(metricGrade(30, { goodThreshold: 20, badThreshold: 30, inverse: true })).toBe("weak");
  });

  it("returns null for missing or non-finite values (unavailable metric)", () => {
    expect(metricGrade(null, { goodThreshold: 1, badThreshold: 0 })).toBeNull();
    expect(metricGrade(undefined, { goodThreshold: 1, badThreshold: 0 })).toBeNull();
    expect(metricGrade(NaN, { goodThreshold: 1, badThreshold: 0 })).toBeNull();
  });
});
