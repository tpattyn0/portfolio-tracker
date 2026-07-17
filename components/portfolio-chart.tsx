"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildAreaPath, buildPath } from "@/lib/utils/chart-path";
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
const MORPH_DURATION_MS = 500;

// Ease-in-out, matching the prototype's morph curve exactly.
function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

export function PortfolioChart({ positions, baseCurrency = "EUR", exchangeRatesUsed }: PortfolioChartProps) {
  const [range, setRange] = useState<Range>("1M");
  const [animatedValues, setAnimatedValues] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const rafRef = useRef<number>();
  const prevValuesRef = useRef<number[]>([]);

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

  const linePath = buildPath(animatedValues, CHART_WIDTH, CHART_HEIGHT);
  const areaPath = buildAreaPath(linePath, CHART_WIDTH, CHART_HEIGHT);

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

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-[220px] w-full"
      >
        <line x1="0" y1="55" x2={CHART_WIDTH} y2="55" className="stroke-line2" />
        <line x1="0" y1="110" x2={CHART_WIDTH} y2="110" className="stroke-line2" />
        <line x1="0" y1="165" x2={CHART_WIDTH} y2="165" className="stroke-line2" />
        <path d={areaPath} className="fill-foreground" fillOpacity={0.05} stroke="none" />
        <path d={linePath} fill="none" className="stroke-foreground" strokeWidth={1.5} />
        <line x1="0" y1={CHART_HEIGHT - 1} x2={CHART_WIDTH} y2={CHART_HEIGHT - 1} className="stroke-border" />
      </svg>

      <div className="mt-2.5 flex justify-between text-[10.5px] uppercase tracking-[0.08em] text-mut">
        {labels.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
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
