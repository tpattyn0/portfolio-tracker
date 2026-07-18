"use client";

import { cn } from "@/lib/utils";
import { scoreBandClass } from "@/lib/utils/score-band";

interface ScoreFigureProps {
  score: number | null | undefined;
  /** 84px headline (DESIGN.md default) or 28px sub-dimension figure. */
  size?: "headline" | "sub";
  /** Show the "/10" suffix (headline size only, per DESIGN.md). */
  showSuffix?: boolean;
  className?: string;
}

/**
 * Newsreader serif numeral, colored by band (DESIGN.md "Score figure").
 * Two sizes: 84px/500 headline (research-detail composite) with a `/10`
 * suffix at 30px `--mut`, and 28px sub-dimension figure (SubscoreBand).
 */
export function ScoreFigure({ score, size = "headline", showSuffix = true, className }: ScoreFigureProps) {
  const color = scoreBandClass(score);
  const display = typeof score === "number" && Number.isFinite(score) ? score.toFixed(1) : "—";

  if (size === "sub") {
    return <div className={cn("font-serif text-[28px]", color, className)}>{display}</div>;
  }

  return (
    <div className={cn("font-serif text-[84px] font-medium leading-none", color, className)}>
      {display}
      {showSuffix && <span className="text-[30px] text-mut">/10</span>}
    </div>
  );
}

interface VerdictStampProps {
  label: string;
  /** Verdict score used to band the stamp color; omit for a fixed color. */
  score?: number | null;
  className?: string;
}

/**
 * Rotated "rubber ink stamp" verdict (DESIGN.md "Verdict stamp"): `3px
 * double` border in the verdict's band color, matching text, rotated -3deg.
 */
export function VerdictStamp({ label, score, className }: VerdictStampProps) {
  const color = scoreBandClass(score);
  return (
    <div
      className={cn(
        "mt-[22px] inline-block -rotate-3 px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.2em]",
        color,
        className
      )}
      style={{ border: "3px double currentColor" }}
    >
      {label}
    </div>
  );
}
