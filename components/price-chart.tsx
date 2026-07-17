// components/price-chart.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  symbol: string;
  name: string;
  showSummary?: boolean;
  currency?: string;
}

const periods = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
];

export function PriceChart({ symbol, name, showSummary = true, currency }: PriceChartProps) {
  const [period, setPeriod] = useState("1M");

  const { data, isLoading, error } = useQuery({
    queryKey: ["chart", symbol, period],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch chart data");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card px-7 py-6">
        <div className="mb-4 font-serif text-xl">Price history</div>
        <div className="h-[400px] w-full animate-pulse rounded bg-fill" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-card px-7 py-6">
        <div className="mb-4 font-serif text-xl">Price history</div>
        <div className="flex h-[400px] items-center justify-center text-mut">
          Failed to load chart data
        </div>
      </div>
    );
  }

  const chartData = data.chart || [];
  const indicators = data.indicators || {};
  const firstValue = chartData[0]?.value || 0;
  const lastValue = chartData[chartData.length - 1]?.value || 0;
  const change = lastValue - firstValue;
  const changePercent = firstValue ? (change / firstValue) * 100 : 0;

  // Calculate technical analysis score
  let buySignals = 0;
  let totalSignals = 0;

  // Price vs MAs
  if (indicators.sma20 !== null && indicators.sma20 !== undefined) {
    totalSignals++;
    if (lastValue > indicators.sma20) buySignals++;
  }
  if (indicators.sma50 !== null && indicators.sma50 !== undefined) {
    totalSignals++;
    if (lastValue > indicators.sma50) buySignals++;
  }

  // RSI
  if (indicators.rsi14 !== null && indicators.rsi14 !== undefined) {
    totalSignals++;
    if (indicators.rsi14 < 70 && indicators.rsi14 > 30) buySignals += 0.5; // Neutral
    else if (indicators.rsi14 < 30) buySignals++; // Oversold = buy
  }

  // MACD
  if (indicators.macd?.value !== null && indicators.macd?.signal !== null) {
    totalSignals++;
    if (indicators.macd.value > indicators.macd.signal) buySignals++;
  }

  const score = totalSignals > 0 ? Math.round((buySignals / totalSignals) * 10) : 5;

  // Add moving averages to chart data
  const enhancedChartData = chartData.map((point: { date: string; value: number; volume: number }) => ({
    ...point,
    sma20: indicators.sma20,
    sma50: indicators.sma50,
  }));

  return (
    <div className="rounded-lg border border-border bg-card px-7 py-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-serif text-xl">{name}</div>
          <p className="text-sm text-mut">{symbol}</p>
          <div className="mt-2">
            <span className="text-2xl font-bold">
              {formatCurrency(lastValue, currency)}
            </span>
            <span
              className={cn(
                "ml-2 text-sm",
                change >= 0 ? "text-up" : "text-dn"
              )}
            >
              {change >= 0 ? "+" : ""}
              {formatCurrency(change, currency)} ({changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-[18px]">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                "border-b pb-0.5 text-[10.5px] tracking-[0.12em]",
                p.value === period
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent font-normal text-mut"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enhancedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line2)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "var(--mut)" }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  if (period === "1D") {
                    return date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  } else if (period === "1W") {
                    return format(date, "EEE");
                  } else if (["1M", "3M"].includes(period)) {
                    return format(date, "MMM d");
                  } else {
                    return format(date, "MMM yy");
                  }
                }}
                interval={period === "1D" ? 3 : "preserveStartEnd"}
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 12, fill: "var(--mut)" }}
                tickFormatter={(value) => {
                  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency || '$';
                  return `${currencySymbol}${value.toFixed(2)}`;
                }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value, currency),
                  name === 'value' ? 'Price' : name
                ]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--foreground)"
                strokeWidth={1.5}
                dot={false}
                name="Price"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {showSummary && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-sub">RSI (14)</p>
                <p className="font-medium">
                  {indicators.rsi14?.toFixed(2) || "-"}
                </p>
                <p className="mt-1 text-xs text-mut">
                  {indicators.rsi14
                    ? indicators.rsi14 > 70
                      ? "Overbought - potential sell signal"
                      : indicators.rsi14 < 30
                      ? "Oversold - potential buy signal"
                      : "Neutral momentum"
                    : "Not enough data"}
                </p>
              </div>
              <div>
                <p className="text-sm text-sub">SMA (20)</p>
                <p className="font-medium">
                  {indicators.sma20 ? formatCurrency(indicators.sma20, currency) : "-"}
                </p>
                <p className="mt-1 text-xs text-mut">
                  {indicators.sma20
                    ? lastValue > indicators.sma20
                      ? "Price above SMA - bullish"
                      : "Price below SMA - bearish"
                    : "Not enough data"}
                </p>
              </div>
              <div>
                <p className="text-sm text-sub">SMA (50)</p>
                <p className="font-medium">
                  {indicators.sma50 ? formatCurrency(indicators.sma50, currency) : "-"}
                </p>
                <p className="mt-1 text-xs text-mut">
                  {indicators.sma50
                    ? lastValue > indicators.sma50
                      ? "Above medium-term trend"
                      : "Below medium-term trend"
                    : "Not enough data"}
                </p>
              </div>
              <div>
                <p className="text-sm text-sub">Signal</p>
                <p className={cn(
                  "font-medium",
                  score >= 7 ? "text-up" :
                  score <= 3 ? "text-dn" : "text-sub"
                )}>
                  {indicators.signal?.replace("_", " ") || "HOLD"}
                </p>
                <p className="mt-1 text-xs font-medium">
                  Score: {score}/10
                </p>
              </div>
            </div>

            {/* Overall interpretation */}
            <div className="rounded-md bg-fill p-3">
              <p className="text-sm font-medium text-sub">Technical Analysis Summary</p>
              <p className="mt-1 text-sm text-sub">
                {score >= 7
                  ? `Strong buy signals with ${buySignals} out of ${totalSignals} indicators positive. The stock shows strong momentum and is trading above key moving averages.`
                  : score >= 5
                  ? `Mixed signals with ${buySignals} out of ${totalSignals} indicators positive. Consider waiting for a clearer trend or use fundamental analysis to guide decisions.`
                  : score >= 3
                  ? `Mostly neutral to bearish signals. The stock may be consolidating or in a downtrend. Monitor for potential reversal signals.`
                  : `Strong sell signals with only ${buySignals} out of ${totalSignals} indicators positive. The stock shows weak momentum and bearish technical setup.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}