"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScoreFigure, VerdictStamp } from "./score-figure";

interface HeadlineScoreCardProps {
  /** Left-aligned section kicker, e.g. "Technical analysis". */
  kicker: string;
  /** Right-aligned muted meta kicker, e.g. "Daily bars · updated at close". */
  metaKicker?: string;
  score: number | null | undefined;
  /**
   * Either a rotated VerdictStamp (Overview, Analysts) or a plain verdict
   * kicker line — never both (DESIGN.md "Headline score card").
   */
  verdictStamp?: string;
  verdictKicker?: string;
  /** Band the verdict kicker's color to the score (e.g. "Positive momentum"). */
  verdictKickerBanded?: boolean;
  /** Italic serif summary paragraph under the verdict. */
  summary?: string;
  /** Extra content between the verdict/summary and the right column slot (Intrinsic's fair-value figure). */
  leftExtra?: ReactNode;
  /** Right-hand flexible slot: dimension band / chart / distribution / scenario band / tone band. */
  children: ReactNode;
  className?: string;
}

/**
 * The single editorial headline pattern reused across Overview, Technical,
 * Fundamental, Analysts, Intrinsic value, and News & sentiment tabs — one
 * component, not six (DESIGN.md "Headline score card").
 */
export function HeadlineScoreCard({
  kicker,
  metaKicker,
  score,
  verdictStamp,
  verdictKicker,
  verdictKickerBanded,
  summary,
  leftExtra,
  children,
  className,
}: HeadlineScoreCardProps) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card px-7 pb-7 pt-6", className)}
      style={{ borderTop: "3px double var(--foreground)" }}
    >
      <div className="flex items-center justify-between border-b border-line2 pb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{kicker}</span>
        {metaKicker && (
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-mut">{metaKicker}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-14 pt-7 sm:grid-cols-[280px_1fr]">
        <div>
          <ScoreFigure score={score} size="headline" />

          {verdictStamp && <VerdictStamp label={verdictStamp} score={score} />}
          {!verdictStamp && verdictKicker && (
            <div
              className={cn(
                "mt-5 text-[10.5px] uppercase tracking-[0.12em]",
                verdictKickerBanded ? "font-semibold text-up" : "text-mut"
              )}
            >
              {verdictKicker}
            </div>
          )}

          {leftExtra}

          {summary && (
            <p className="mt-2.5 font-serif text-[14.5px] italic leading-[1.55] text-mut">
              {summary}
            </p>
          )}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
