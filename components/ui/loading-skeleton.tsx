import { cn } from "@/lib/utils";

/**
 * Meridian route-level loading skeleton primitives (DESIGN.md "Loading
 * skeleton (route-level loading.tsx)", plan Task 7,
 * plans/2026-07-18-performance-audit-remediation.md).
 *
 * Every loading.tsx composes these — never one-off markup — so a
 * skeleton's column count, card count, and block order trace back to the
 * real page's own layout (DESIGN.md's "Rule for the Coding agent").
 */

interface SkeletonBlockProps {
  className?: string;
}

/**
 * The one shimmer primitive every skeleton composes from. `bg-fill` +
 * Tailwind's built-in `animate-pulse` — opacity pulse only, no sweep/
 * gradient shimmer (DESIGN.md: Meridian has no motion vocabulary beyond the
 * theme-transition fade and the hero chart's range-morph).
 */
export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return <div className={cn("animate-pulse rounded bg-fill", className)} />;
}

type SkeletonTextVariant = "h1" | "kicker" | "body" | "detail" | "pill";

const TEXT_VARIANT_CLASS: Record<SkeletonTextVariant, string> = {
  // Screen H1 — Newsreader 52px/500 (DESIGN.md Typography).
  h1: "h-[52px] w-64 rounded",
  // Kicker / label — 10.5–11px uppercase.
  kicker: "h-[11px] w-40 rounded",
  // Body / table text — 13.5px.
  body: "h-[13.5px] w-full rounded",
  // Secondary / detail text — 12–12.5px.
  detail: "h-[12px] w-32 rounded",
  // Pill-shaped action button.
  pill: "h-[38px] w-32 rounded-full",
};

interface SkeletonTextProps {
  variant: SkeletonTextVariant;
  className?: string;
}

/** A SkeletonBlock sized to one line of a named Type-scale row. */
export function SkeletonText({ variant, className }: SkeletonTextProps) {
  return <SkeletonBlock className={cn(TEXT_VARIANT_CLASS[variant], className)} />;
}

interface SkeletonStatBandProps {
  columns: number;
  /** Card-wrapped variant (Closed-positions 6-col summary, Research-detail 4-col stat card). */
  card?: boolean;
  className?: string;
}

/**
 * Mirrors the Ruled stat band component: border-y row, N equal columns,
 * `border-l border-line2` after the first, each cell a kicker block over a
 * 26px value block over a 12px detail block. First/last cell flush padding.
 */
export function SkeletonStatBand({ columns, card, className }: SkeletonStatBandProps) {
  return (
    <div
      className={cn(
        "grid border-y border-border",
        card && "rounded-lg border border-border bg-card",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "space-y-2 py-[18px] pb-5",
            i === 0 ? (card ? "px-7" : "pr-12") : i === columns - 1 ? (card ? "px-7" : "pl-12") : "px-12",
            i > 0 && "border-l border-line2"
          )}
        >
          <SkeletonText variant="kicker" className="w-24" />
          <SkeletonBlock className="h-[26px] w-28" />
          <SkeletonText variant="detail" className="w-28" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  /** Editorial card — `border-t: 3px double var(--ink)` (Headline score card, Morning Note). */
  editorial?: boolean;
  children?: React.ReactNode;
}

/** Mirrors the Card component: rounded-lg border bg-card wrapper. */
export function SkeletonCard({ className, editorial, children }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6",
        editorial && "border-t-[3px] border-double border-foreground",
        className
      )}
    >
      {children ?? <SkeletonBlock className="h-32 w-full" />}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  className?: string;
}

/**
 * Mirrors the Position/Watchlist table row shell: header row of
 * kicker-height blocks, then `rows` body rows each with a bottom rule
 * (omitted on the last), each row a horizontal flex approximating a
 * two-line name+ticker cell plus right-aligned numeric columns.
 */
export function SkeletonTable({ rows = 5, className }: SkeletonTableProps) {
  return (
    <div className={className}>
      <div className="flex gap-6 border-b border-border pb-2.5">
        <SkeletonText variant="kicker" className="w-32" />
        <SkeletonText variant="kicker" className="ml-auto w-20" />
        <SkeletonText variant="kicker" className="w-20" />
        <SkeletonText variant="kicker" className="w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-6 py-[15px]",
            i < rows - 1 && "border-b border-line2"
          )}
        >
          <div className="space-y-1.5">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonText variant="kicker" className="w-20" />
          </div>
          <SkeletonBlock className="ml-auto h-4 w-16" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors the research-detail Segmented tabs bar: a flex row of 7
 * pill-free label-width blocks sampling the real tab labels' lengths, no
 * active state (skeletons never show a selected treatment).
 */
export function SkeletonTabBar({ className }: { className?: string }) {
  const widths = ["w-16", "w-20", "w-24", "w-16", "w-28", "w-24", "w-32"];
  return (
    <div className={cn("flex gap-8 border-b border-border pb-3", className)}>
      {widths.map((w, i) => (
        <SkeletonBlock key={i} className={cn("h-[11px]", w)} />
      ))}
    </div>
  );
}
