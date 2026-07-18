/**
 * Presentational score-banding helpers for the Meridian research-detail views
 * (plans/2026-07-18-meridian-research-detail.md, ADR-11). These recolor
 * already-computed scores/metrics against fixed thresholds — they never
 * change scoring math (DESIGN.md "Score figure" / "Grading dot").
 *
 * Thresholds (0-10 scale): >= 7 up, 4-7 amber, < 4 down, null/NaN -> muted.
 */

export type ScoreBand = "up" | "amber" | "dn" | "mut";

/** Tailwind text-color class for a 0-10 score, per DESIGN.md Score figure thresholds. */
export function scoreBandClass(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "text-mut";
  }
  if (score >= 7) return "text-up";
  if (score >= 4) return "text-amber";
  return "text-dn";
}

/** Raw band (no Tailwind prefix) for a 0-10 score — useful for building other class names. */
export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "mut";
  }
  if (score >= 7) return "up";
  if (score >= 4) return "amber";
  return "dn";
}

export type MetricGrade = "strong" | "inline" | "weak" | null;

/** Tailwind text-color class for a Grading dot (DESIGN.md "Grading dot"). */
export function gradingDotClass(status: MetricGrade): string {
  if (status === "strong") return "text-up";
  if (status === "inline") return "text-amber";
  if (status === "weak") return "text-dn";
  return "text-mut";
}

/**
 * Reproduces the 3-tier threshold logic already used inline by
 * `fundamental-analysis.tsx`'s `MetricRow` (goodThreshold / badThreshold /
 * inverse), extracted as a pure function so it can back both the legacy
 * component and the new `GradedMetricRow`. `null`/`undefined` value ->
 * `null` grade (unavailable).
 *
 * - `inverse: false` (higher is better, the default): value >= goodThreshold
 *   -> "strong"; value <= badThreshold -> "weak"; otherwise "inline".
 * - `inverse: true` (lower is better): value <= goodThreshold -> "strong";
 *   value >= badThreshold -> "weak"; otherwise "inline".
 */
export function metricGrade(
  value: number | null | undefined,
  options: { goodThreshold: number; badThreshold: number; inverse?: boolean }
): MetricGrade {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const { goodThreshold, badThreshold, inverse = false } = options;
  if (inverse) {
    if (value <= goodThreshold) return "strong";
    if (value >= badThreshold) return "weak";
    return "inline";
  }
  if (value >= goodThreshold) return "strong";
  if (value <= badThreshold) return "weak";
  return "inline";
}
