"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildAreaPath, buildPath, CHART_DOMAIN_MARGIN, gridlineYs, marginDomain } from "@/lib/utils/chart-path";
import { niceYTicks } from "@/lib/utils/chart-ticks";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "FROM_START";

interface PortfolioChartProps {
  positions?: Array<{ id: string; ticker: string; name: string; quantity: number }>;
  baseCurrency?: string;
  exchangeRatesUsed?: Array<{ from: string; to: string; rate: number }>;
  totalValue?: number;
  totalCost?: number;
}

const ranges: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "10Y", value: "10Y" },
  { label: "From Start", value: "FROM_START" },
];

const CHART_WIDTH = 1300;
const CHART_HEIGHT = 220;
const CHART_PADDING = 8; // must match buildPath's default padding — kept in sync explicitly.
const MORPH_DURATION_MS = 500;

// Ease-in-out, matching the prototype's morph curve exactly.
function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

export function PortfolioChart({ positions, baseCurrency = "EUR", exchangeRatesUsed }: PortfolioChartProps) {
  const [range, setRange] = useState<Range>("1M");
  const [animatedValues, setAnimatedValues] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [series, setSeries] = useState<Array<{ date: string; value: number }>>([]);
  const rafRef = useRef<number>();
  const prevValuesRef = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio-performance", range, baseCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/performance?range=${range}&baseCurrency=${baseCurrency}`);
      if (!res.ok) throw new Error("Failed to load performance");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data?.series) return;

    const raw = data.series as Array<{ date: string; value: number }>;
    const nextValues = raw.map((p) => p.value);
    const nextLabels = pickLabels(raw.map((p) => p.date), range);

    setLabels(nextLabels);
    setSeries(raw);

    const from = prevValuesRef.current.length === nextValues.length
      ? prevValuesRef.current
      : nextValues; // shape changed (different series length) — snap instead of morph

    cancelAnimationFrame(rafRef.current!);
    const start = performance.now();

    const step = (t: number) => {
      const k = Math.min(1, (t - start) / MORPH_DURATION_MS);
      const eased = easeInOut(k);
      const interpolated = from.map((v, i) => v + (nextValues[i] - v) * eased);
      setAnimatedValues(interpolated);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevValuesRef.current = nextValues;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  // Hover crosshair pixel-mapping — mirrors DetailPriceChart's container-ref
  // approach exactly (mousemove -> nearest index by fractional x position).
  // Deliberately independent of the RAF morph effect above: it only reads
  // `animatedValues`/`series` state, never touches `rafRef` or cancels/
  // restarts the morph.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el || animatedValues.length === 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = animatedValues.length > 1 ? Math.round(frac * (animatedValues.length - 1)) : 0;
    setHoverIndex(idx);
  }

  function handleMouseLeave() {
    setHoverIndex(null);
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-mut">
        <div className="text-center">
          <p className="text-sm">No portfolio data to display</p>
          <p className="mt-1 text-xs">Add positions to see your performance chart</p>
        </div>
      </div>
    );
  }

  if (isLoading || animatedValues.length === 0) {
    return <div className="h-[220px] w-full animate-pulse rounded bg-fill" />;
  }

  if (isError || !data?.series) {
    return (
      <div className="flex h-[220px] items-center justify-center text-mut">
        Unable to load performance data
      </div>
    );
  }

  // Y-axis ticks computed from the currently *displayed* (animating) series —
  // labels update live as the morph runs, matching how the value figure
  // animates elsewhere (DESIGN.md).
  const finiteAnimated = animatedValues.filter((v) => Number.isFinite(v));
  const yMin = finiteAnimated.length ? Math.min(...finiteAnimated) : 0;
  const yMax = finiteAnimated.length ? Math.max(...finiteAnimated) : 0;
  const yTicks = niceYTicks(yMin, yMax, 3);
  // The *drawing* domain buildPath/gridlineYs map into is slightly wider than
  // the true [yMin, yMax] — a small symmetric margin that gives the
  // Catmull-Rom spline's overshoot room to stay inside the plot instead of
  // clipping below the floor / above the ceiling
  // (plans/2026-07-20-perf-graph-dip-clipping-fix.md). `yTicks` above (the
  // LABEL values) stay on the true min/max — only the pixel mapping changes.
  const { domainMin, domainMax } = marginDomain(yMin, yMax, CHART_DOMAIN_MARGIN);

  const linePath = buildPath(animatedValues, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, CHART_DOMAIN_MARGIN);
  const areaPath = buildAreaPath(linePath, CHART_WIDTH, CHART_HEIGHT);

  // Gridline/label y-positions derived from the same margined padded domain
  // buildPath uses to plot the line, so the series' max/min always land
  // exactly on the top/bottom gridlines (plans/2026-07-20-small-visual-fixes.md,
  // Issue 4; margined domain per the dip-clipping fix above).
  const gridYs = gridlineYs(domainMin, domainMax, CHART_HEIGHT, CHART_PADDING, yTicks);

  const hoverValue = hoverIndex !== null ? animatedValues[hoverIndex] : undefined;
  const hoverDate = hoverIndex !== null ? series[hoverIndex]?.date : undefined;
  const hoverXFrac = hoverIndex !== null && animatedValues.length > 1 ? hoverIndex / (animatedValues.length - 1) : 0;
  // Same margined domain as the line/gridlines above, so the hover marker
  // stays registered with the drawn curve (including inside the dip's new
  // headroom) rather than the pre-margin [yMin, yMax] fraction.
  const domainRange = domainMax - domainMin || 1;
  const hoverYFrac = hoverValue !== undefined ? 1 - (hoverValue - domainMin) / domainRange : 0;

  return (
    <div>
      {exchangeRatesUsed && exchangeRatesUsed.length > 0 && (
        <div className="mb-3 text-xs text-mut">
          <span className="font-medium">Rates:</span>{" "}
          {exchangeRatesUsed.map((rate, idx) => (
            <span key={`${rate.from}-${rate.to}`}>
              {idx > 0 && ", "}
              <span className="font-mono">
                {rate.from}/{rate.to} {rate.rate.toFixed(4)}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex justify-end gap-[18px]">
        {ranges.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={cn(
              "border-b pb-0.5 text-[10.5px] tracking-[0.12em]",
              r.value === range
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent font-normal text-mut"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="relative pl-14">
        {/* Y-axis price labels — rendered as HTML text against the container, not
            inside the preserveAspectRatio="none" SVG, which would distort them. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12">
          {yTicks.map((tick, i) => (
            <div
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[10.5px] text-mut"
              style={{ top: `${(gridYs[i] ?? gridYs[gridYs.length - 1]) / CHART_HEIGHT * 100}%` }}
            >
              {formatCurrency(tick, baseCurrency)}
            </div>
          ))}
        </div>

        <div
          ref={containerRef}
          className="relative h-[220px] w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-full w-full"
          >
            {gridYs.map((y, i) => (
              <line key={yTicks[i] ?? i} x1="0" y1={y} x2={CHART_WIDTH} y2={y} className="stroke-line2" />
            ))}
            <path d={areaPath} className="fill-foreground" fillOpacity={0.05} stroke="none" />
            <path d={linePath} fill="none" className="stroke-foreground" strokeWidth={1.5} />
            <line x1="0" y1={CHART_HEIGHT - 1} x2={CHART_WIDTH} y2={CHART_HEIGHT - 1} className="stroke-border" />
          </svg>

          {/* Hover crosshair + marker — pixel position computed from the container's
              measured width, not viewBox units, since the SVG is preserveAspectRatio="none". */}
          {hoverValue !== undefined && (
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
                {hoverDate && <div className="text-mut">{format(new Date(hoverDate), "MMM d, yyyy")}</div>}
                <div className="font-medium text-foreground">{formatCurrency(hoverValue, baseCurrency)}</div>
              </div>
            </>
          )}
        </div>

        <div className="mt-2.5 flex justify-between text-[10.5px] uppercase tracking-[0.08em] text-mut">
          {labels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Picks ~5 evenly-spaced labels from a date series, formatted per range granularity. */
function pickLabels(dates: string[], range: Range): string[] {
  if (dates.length === 0) return [];
  const isIntraday = range === "1D" || range === "1W";
  const count = Math.min(5, dates.length);
  const step = (dates.length - 1) / Math.max(1, count - 1);

  const indices = Array.from({ length: count }, (_, i) => Math.round(i * step));
  const unique = Array.from(new Set(indices));

  return unique.map((idx) => {
    const d = new Date(dates[idx]);
    if (isIntraday) return format(d, "HH:mm");
    if (["5Y", "10Y", "FROM_START"].includes(range)) return format(d, "MMM yy");
    return format(d, "MMM d");
  });
}
