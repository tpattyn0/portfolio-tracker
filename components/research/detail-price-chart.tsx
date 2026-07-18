"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildAreaPath, buildPath } from "@/lib/utils/chart-path";
import { niceYTicks } from "@/lib/utils/chart-ticks";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export interface DetailPriceChartReferenceLine {
  value: number;
  label: string;
}

interface DetailPriceChartProps {
  symbol: string;
  /** Overview="1Y" (static, no range tabs) or Technical="6M" per DESIGN.md. */
  period: "1Y" | "6M";
  currency?: string;
  /**
   * Optional dashed support/resistance lines (Technical tab only). Omit
   * entirely (both lines and legend) when unavailable — never fabricate a
   * level (TD-DTL-SR).
   */
  referenceLines?: DetailPriceChartReferenceLine[];
  className?: string;
}

interface ChartDataPoint {
  date: string;
  value: number;
}

// Overview uses viewBox 0 0 1300 190; Technical uses 0 0 1000 190 (DESIGN.md
// "Detail price chart"). Both share the same 190-tall gridline fractions.
const CHART_HEIGHT = 190;
const GRIDLINE_Y = [47, 94, 141];

/**
 * Research-detail Overview/Technical chart (ADR-11): reuses buildPath/
 * buildAreaPath (unchanged) but is a distinct component from the dashboard
 * hero chart — no range-morph, adds a minimal y-axis, hover crosshair +
 * tooltip, and optional dashed reference lines (DESIGN.md "Detail price
 * chart").
 */
export function DetailPriceChart({ symbol, period, currency, referenceLines, className }: DetailPriceChartProps) {
  const width = period === "1Y" ? 1300 : 1000;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["chart", symbol, period],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch chart data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const points: ChartDataPoint[] = useMemo(() => data?.chart ?? [], [data]);
  const values = useMemo(() => points.map((p) => p.value), [points]);

  const linePath = useMemo(() => buildPath(values, width, CHART_HEIGHT), [values, width]);
  const areaPath = useMemo(() => buildAreaPath(linePath, width, CHART_HEIGHT), [linePath, width]);

  const finiteValues = values.filter((v) => Number.isFinite(v));
  const min = finiteValues.length ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length ? Math.max(...finiteValues) : 0;
  const yTicks = useMemo(() => niceYTicks(min, max, 3), [min, max]);

  const dateLabels = useMemo(() => {
    if (points.length === 0) return [];
    const count = Math.min(5, points.length);
    const step = (points.length - 1) / Math.max(1, count - 1);
    const indices = Array.from(new Set(Array.from({ length: count }, (_, i) => Math.round(i * step))));
    return indices.map((idx) => format(new Date(points[idx].date), "MMM yyyy"));
  }, [points]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = points.length > 1 ? Math.round(frac * (points.length - 1)) : 0;
    setHoverIndex(idx);
  }

  function handleMouseLeave() {
    setHoverIndex(null);
  }

  if (isLoading) {
    return <div className={cn("h-[190px] w-full animate-pulse rounded bg-fill", className)} />;
  }

  if (error || !data || linePath === "") {
    return (
      <div className={cn("flex h-[190px] items-center justify-center text-mut", className)}>
        Chart data unavailable
      </div>
    );
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  // Shared y-domain denominator for both the hover marker and reference lines
  // (MRD-S2) — named for what it represents (the plotted value range), not
  // which feature reads it first.
  const valueRange = max - min || 1;
  const hoverXFrac = hoverIndex !== null && points.length > 1 ? hoverIndex / (points.length - 1) : 0;
  const hoverYFrac = hoverPoint ? 1 - (hoverPoint.value - min) / valueRange : 0;

  return (
    <div className={className}>
      <div className="relative pl-14">
        {/* Y-axis price labels — rendered as HTML text against the container, not inside the
            preserveAspectRatio="none" SVG, which would distort them (DESIGN.md). */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12">
          {yTicks.map((tick, i) => (
            <div
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[10.5px] text-mut"
              style={{ top: `${(GRIDLINE_Y[i] ?? GRIDLINE_Y[GRIDLINE_Y.length - 1]) / CHART_HEIGHT * 100}%` }}
            >
              {formatCurrency(tick, currency)}
            </div>
          ))}
        </div>

        <div
          ref={containerRef}
          className="relative h-[190px] w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="block h-full w-full">
            {GRIDLINE_Y.map((y) => (
              <line key={y} x1="0" y1={y} x2={width} y2={y} className="stroke-line2" />
            ))}
            {referenceLines?.map((ref) => {
              // Clamp to [min, max] so a level outside the plotted range
              // (e.g. a support/resistance level from a wider lookback than
              // the visible series) still renders at the plot's edge instead
              // of being clipped off the visible SVG area (MRD-S2).
              const clampedValue = Math.max(min, Math.min(max, ref.value));
              const yFrac = 1 - (clampedValue - min) / valueRange;
              const y = yFrac * CHART_HEIGHT;
              return (
                <line
                  key={ref.label}
                  x1="0"
                  y1={y}
                  x2={width}
                  y2={y}
                  className="stroke-mut"
                  strokeWidth={1}
                  strokeDasharray="6 5"
                />
              );
            })}
            <path d={areaPath} className="fill-foreground" fillOpacity={0.05} stroke="none" />
            <path d={linePath} fill="none" className="stroke-foreground" strokeWidth={1.5} />
            <line x1="0" y1={CHART_HEIGHT - 1} x2={width} y2={CHART_HEIGHT - 1} className="stroke-border" />
          </svg>

          {/* Hover crosshair + marker — pixel position computed from the container's
              measured width, not viewBox units, since the SVG is preserveAspectRatio="none". */}
          {hoverPoint && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-line"
                style={{ left: `${hoverXFrac * 100}%` }}
              />
              <div
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                style={{ left: `${hoverXFrac * 100}%`, top: `${hoverYFrac * 100}%` }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-y-full rounded-md border border-border bg-card px-3 py-2 text-[12px] shadow-none"
                style={{
                  left: `${hoverXFrac * 100}%`,
                  top: `${Math.max(0, hoverYFrac * 100 - 4)}%`,
                  transform: `translate(${hoverXFrac > 0.85 ? "-100%" : hoverXFrac < 0.15 ? "0%" : "-50%"}, -100%)`,
                }}
              >
                <div className="text-mut">{format(new Date(hoverPoint.date), "MMM d, yyyy")}</div>
                <div className="font-medium text-foreground">{formatCurrency(hoverPoint.value, currency)}</div>
              </div>
            </>
          )}
        </div>

        {referenceLines && referenceLines.length > 0 && (
          <div className="mt-2 flex justify-between text-[10.5px] uppercase tracking-[0.08em] text-mut">
            <span>
              {referenceLines.map((ref, i) => (
                <span key={ref.label}>
                  {i > 0 && " · "}
                  {ref.label} {formatCurrency(ref.value, currency)} ┄
                </span>
              ))}
            </span>
          </div>
        )}

        {period === "1Y" && dateLabels.length > 0 && (
          <div className="mt-2.5 flex justify-between text-[10.5px] uppercase tracking-[0.08em] text-mut">
            {dateLabels.map((label, i) => (
              <span key={`${label}-${i}`}>{label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
