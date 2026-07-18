import { describe, expect, it } from "vitest";
import { round1, sentimentToScore, upsideToScore } from "./research-scores";

describe("sentimentToScore", () => {
  it("maps -1..1 sentiment onto 0..10", () => {
    expect(sentimentToScore(-1)).toBe(0);
    expect(sentimentToScore(0)).toBe(5);
    expect(sentimentToScore(1)).toBe(10);
  });

  it("defaults missing sentiment to neutral (score 5)", () => {
    expect(sentimentToScore(null)).toBe(5);
    expect(sentimentToScore(undefined)).toBe(5);
  });

  it("clamps out-of-range input", () => {
    expect(sentimentToScore(-2)).toBe(0);
    expect(sentimentToScore(2)).toBe(10);
  });
});

describe("upsideToScore", () => {
  it("maps the documented boundary points", () => {
    expect(upsideToScore(-25)).toBe(0);
    // 0% sits at (0 - -25) / (30 - -25) = 25/55 of the range, not exactly the
    // midpoint (the range is asymmetric: -25 to +30) -> 4.5, not 5.
    expect(upsideToScore(0)).toBe(4.5);
    expect(upsideToScore(30)).toBe(10);
  });

  it("defaults missing upside to neutral (score 5)", () => {
    expect(upsideToScore(null)).toBe(5);
    expect(upsideToScore(undefined)).toBe(5);
  });

  it("clamps beyond the -25/+30 range", () => {
    expect(upsideToScore(-100)).toBe(0);
    expect(upsideToScore(100)).toBe(10);
  });
});

describe("round1", () => {
  it("rounds to one decimal place", () => {
    expect(round1(7.849)).toBe(7.8);
    expect(round1(7.85)).toBe(7.9);
    expect(round1(3)).toBe(3);
  });
});
