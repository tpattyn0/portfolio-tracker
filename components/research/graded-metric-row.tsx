"use client";

import { cn } from "@/lib/utils";
import { gradingDotClass, type MetricGrade } from "@/lib/utils/score-band";

interface GradedMetricRowProps {
  label: string;
  /** Pre-formatted display value, or "—" / undefined when unavailable. */
  value: string | null | undefined;
  grade?: MetricGrade;
  /** Suppress the grading dot entirely (rare — most rows show one). */
  hideDot?: boolean;
  className?: string;
}

/**
 * Label (muted) + value (weight-500) + a grading dot, `justify-between` row
 * with a `1px --line2` bottom rule (DESIGN.md "Graded metric row" /
 * "Grading dot"). The dot is a `●` glyph immediately after the value.
 */
export function GradedMetricRow({ label, value, grade, hideDot, className }: GradedMetricRowProps) {
  const display = value ?? "—";
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-line2 py-2.5 text-[13.5px]",
        className
      )}
    >
      <span className="text-sub">{label}</span>
      <span className="font-medium text-foreground">
        {display}
        {!hideDot && <span className={cn("ml-2", gradingDotClass(grade ?? null))}>●</span>}
      </span>
    </div>
  );
}
