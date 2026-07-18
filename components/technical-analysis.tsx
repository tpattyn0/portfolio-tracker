"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { DetailPriceChart } from "@/components/research/detail-price-chart";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

interface TechnicalAnalysisProps {
  symbol: string;
  currency?: string;
}

interface IndicatorRow {
  label: string;
  reading: string;
  interpretation: string;
  signal: "bullish" | "bearish" | "neutral" | undefined;
}

function signalLabel(signal: IndicatorRow["signal"]): "BUY" | "NEUTRAL" | "SELL" {
  if (signal === "bullish") return "BUY";
  if (signal === "bearish") return "SELL";
  return "NEUTRAL";
}

function signalColor(signal: IndicatorRow["signal"]): string {
  if (signal === "bullish") return "text-up";
  if (signal === "bearish") return "text-dn";
  return "text-amber";
}

export function TechnicalAnalysis({ symbol, currency }: TechnicalAnalysisProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["technical-analysis", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=1Y`);
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        Loading technical analysis…
      </div>
    );
  }

  if (error || !data?.indicators) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        <AlertCircle className="mr-2 h-4 w-4" />
        Unable to load technical analysis
      </div>
    );
  }

  const indicators = data.indicators;
  const signal: string = indicators.signal;
  const signalScore = typeof indicators.score === "number" ? indicators.score : 5;
  const currentPriceRaw = data.chart[data.chart.length - 1]?.value;
  const currentPrice: number | null = typeof currentPriceRaw === "number" ? currentPriceRaw : null;
  const breakdown = indicators.breakdown || {};

  const summary =
    signalScore >= 8
      ? "Strong bullish signals across multiple indicators."
      : signalScore >= 6
      ? "Moderate bullish signals — positive trend indicated."
      : signalScore <= 2
      ? "Strong bearish signals suggest caution."
      : signalScore <= 4
      ? "Bearish signals — negative trend indicated."
      : "Mixed signals — consider waiting for clearer direction.";

  const rows: IndicatorRow[] = [];

  if (indicators.sma20 !== null && indicators.sma20 !== undefined) {
    rows.push({
      label: "SMA (20)",
      reading: formatCurrency(indicators.sma20, currency),
      interpretation:
        currentPrice == null
          ? "Price unavailable"
          : currentPrice > indicators.sma20
          ? "Price above short-term average"
          : "Price below short-term average",
      signal: breakdown.trend?.sma20?.signal,
    });
  }
  if (indicators.sma50 !== null && indicators.sma50 !== undefined) {
    rows.push({
      label: "SMA (50)",
      reading: formatCurrency(indicators.sma50, currency),
      interpretation:
        currentPrice == null
          ? "Price unavailable"
          : currentPrice > indicators.sma50
          ? "Above medium-term trend"
          : "Below medium-term trend",
      signal: breakdown.trend?.sma50?.signal,
    });
  }
  if (indicators.sma200 !== null && indicators.sma200 !== undefined) {
    rows.push({
      label: "SMA (200)",
      reading: formatCurrency(indicators.sma200, currency),
      interpretation:
        currentPrice == null
          ? "Price unavailable"
          : currentPrice > indicators.sma200
          ? "In long-term uptrend"
          : "In long-term downtrend",
      signal: breakdown.trend?.sma200?.signal,
    });
  }
  if (indicators.sma50 && indicators.sma200) {
    const golden = indicators.sma50 > indicators.sma200;
    rows.push({
      label: golden ? "Golden cross" : "Death cross",
      reading: golden ? "50 > 200" : "50 < 200",
      interpretation: golden ? "Bullish long-term crossover" : "Bearish long-term crossover",
      signal: breakdown.trend?.goldenCross?.signal,
    });
  }
  if (indicators.rsi14 !== null && indicators.rsi14 !== undefined) {
    rows.push({
      label: "RSI (14)",
      reading: indicators.rsi14.toFixed(2),
      interpretation:
        breakdown.momentum?.rsi?.details?.category ||
        (indicators.rsi14 > 70 ? "Overbought" : indicators.rsi14 < 30 ? "Oversold" : "Neutral momentum"),
      signal: breakdown.momentum?.rsi?.signal,
    });
  }
  if (indicators.macd && indicators.macd.value !== null) {
    rows.push({
      label: "MACD",
      reading: indicators.macd.value.toFixed(4),
      interpretation:
        indicators.macd.value > (indicators.macd.signal || 0) ? "MACD above signal — bullish" : "MACD below signal — bearish",
      signal: breakdown.momentum?.macd?.signal,
    });
  }
  if (indicators.stochastic && indicators.stochastic.k !== null) {
    rows.push({
      label: "Stochastic %K",
      reading: indicators.stochastic.k.toFixed(1),
      interpretation:
        indicators.stochastic.k > 80 ? "Overbought" : indicators.stochastic.k < 20 ? "Oversold" : "Neutral",
      signal: breakdown.momentum?.stochastic?.signal,
    });
  }
  if (indicators.bollingerBands && indicators.bollingerBands.middle !== null) {
    rows.push({
      label: "Bollinger Bands",
      reading: `${formatCurrency(indicators.bollingerBands.lower || 0, currency)} – ${formatCurrency(indicators.bollingerBands.upper || 0, currency)}`,
      interpretation:
        breakdown.volatility?.bollinger?.details?.position ||
        (currentPrice && currentPrice > indicators.bollingerBands.upper
          ? "Above upper band"
          : currentPrice && currentPrice < indicators.bollingerBands.lower
          ? "Below lower band"
          : "Within bands"),
      signal: breakdown.volatility?.bollinger?.signal,
    });
  }
  if (indicators.volumeTrend && indicators.volumeTrend.changePercent !== null) {
    rows.push({
      label: "Volume trend",
      reading: `${indicators.volumeTrend.changePercent > 0 ? "+" : ""}${indicators.volumeTrend.changePercent.toFixed(1)}%`,
      interpretation: breakdown.volume?.volumeTrend?.details?.interpretation || "vs 20-day average",
      signal: breakdown.volume?.volumeTrend?.signal,
    });
  }

  return (
    <div className="space-y-5">
      <HeadlineScoreCard
        kicker="Technical analysis"
        metaKicker="Daily bars · updated at close"
        score={signalScore}
        verdictKicker={signal.replace(/_/g, " ")}
        verdictKickerBanded
        summary={summary}
      >
        <DetailPriceChart symbol={symbol} period="6M" currency={currency} />
      </HeadlineScoreCard>

      <div className="rounded-lg border border-border bg-card px-7 pb-7 pt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Indicators</div>
        <table className="mt-5 w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="pb-2.5 text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Indicator</th>
              <th className="pb-2.5 text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Reading</th>
              <th className="pb-2.5 text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Interpretation</th>
              <th className="pb-2.5 text-right text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={cn(i < rows.length - 1 && "border-b border-line2")}>
                <td className="py-[15px] font-medium">{row.label}</td>
                <td className="py-[15px] text-sub">{row.reading}</td>
                <td className="py-[15px] text-[12.5px] text-mut">{row.interpretation}</td>
                <td className={cn("py-[15px] text-right text-[10.5px] font-semibold uppercase tracking-[0.14em]", signalColor(row.signal))}>
                  {signalLabel(row.signal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
