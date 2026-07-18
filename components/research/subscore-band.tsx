"use client";

import { cn } from "@/lib/utils";
import { ScoreFigure } from "./score-figure";

export interface SubscoreItem {
  label: string;
  score: number | null | undefined;
}

interface SubscoreBandProps {
  items: SubscoreItem[];
  className?: string;
}

/**
 * N-column ruled band of 28px ScoreFigures (DESIGN.md "Subscore band"):
 * `1px --line2` vertical rules between columns, first column no left
 * padding, last column no right padding (flush-edge rule). Used for
 * Overview's 5-dimension grid and Fundamental's 5-col subscore band.
 */
export function SubscoreBand({ items, className }: SubscoreBandProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-5", className)}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn("pb-[18px] pr-5", i > 0 && "border-l border-line2 pl-5")}
        >
          <ScoreFigure score={item.score} size="sub" showSuffix={false} />
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
