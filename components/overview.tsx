"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PriceChart } from "@/components/price-chart";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface OverviewProps {
  symbol: string;
  name: string;
  currentPrice: number;
  context?: "portfolio" | "wishlist";
  currency?: string;
}

// Helper mappers
function sentimentToScore(sent: number | null | undefined): number {
  const s = typeof sent === "number" ? sent : 0; // -1..1
  const score = (s + 1) * 5; // 0..10
  return Math.max(0, Math.min(10, score));
}

function upsideToScore(upsidePercent: number | null | undefined): number {
  if (upsidePercent === null || upsidePercent === undefined) return 5;
  // Map -25% -> 0, 0% -> 5, +30% -> 10 (clamped)
  const min = -25;
  const max = 30;
  const clamped = Math.max(min, Math.min(max, upsidePercent));
  const normalized = (clamped - min) / (max - min); // 0..1
  return Math.round(normalized * 10 * 10) / 10; // 0..10, 1 decimal
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function Overview({ symbol, name, currentPrice, context = "portfolio", currency }: OverviewProps) {
  // Chart/technical indicators for score
  const chartQ = useQuery({
    queryKey: ["chart", symbol, "1Y"],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=1Y`);
      if (!res.ok) throw new Error("Failed to fetch chart/indicators");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fundamentals
  const fundamentalsQ = useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/fundamentals/${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch fundamentals");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  // Analyst ratings
  const analystQ = useQuery({
    queryKey: ["analyst-ratings", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/analyst-ratings/${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch analyst ratings");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  // Intrinsic value
  const intrinsicQ = useQuery({
    queryKey: ["intrinsic-value", symbol, currentPrice],
    queryFn: async () => {
      const res = await fetch(`/api/research/${symbol}/intrinsic-value?price=${currentPrice}`);
      if (!res.ok) throw new Error("Failed to fetch intrinsic value");
      return res.json();
    },
    enabled: currentPrice > 0,
    staleTime: 60 * 60 * 1000,
  });

  // News & sentiment (analyzed)
  const newsQ = useQuery({
    queryKey: ["news", symbol, "overview"],
    queryFn: async () => {
      const params = new URLSearchParams({ analyze: "true", limit: "20" });
      params.append("name", name);
      const res = await fetch(`/api/news/${symbol}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Derive subscores
  const technicalScore = useMemo(() => {
    const indicators = chartQ.data?.indicators;
    if (!indicators) return 5;
    // Use the actual calculated score from technical analysis instead of mapping signal
    return typeof indicators.score === 'number' ? indicators.score : 5;
  }, [chartQ.data]);

  const fundamentalScore = useMemo(() => {
    const s = fundamentalsQ.data?.score?.total;
    return typeof s === "number" ? s : 5;
  }, [fundamentalsQ.data]);

  const analystScore = useMemo(() => {
    const s = analystQ.data?.score;
    if (typeof s !== "number") return 5;
    return Math.max(0, Math.min(10, s));
  }, [analystQ.data]);

  const intrinsicScore = useMemo(() => {
    const up = intrinsicQ.data?.upsidePercent as number | null | undefined;
    return upsideToScore(up);
  }, [intrinsicQ.data]);

  const sentimentScore = useMemo(() => {
    const articles = (newsQ.data || []) as Array<{ sentiment: number | null; impact?: string | null; relevanceScore?: number | null }>;
    if (!Array.isArray(articles) || articles.length === 0) return 5;
    // Weighted average like SentimentScore component
    let weighted = 0;
    let totalW = 0;
    for (const a of articles) {
      const s = a.sentiment ?? 0;
      let w = 1;
      if (a.impact === "high") w = 3; else if (a.impact === "medium") w = 2;
      const rel = a.relevanceScore ?? 0.5;
      const weight = w * rel;
      weighted += s * weight;
      totalW += weight;
    }
    const avg = totalW > 0 ? weighted / totalW : 0;
    return round1(sentimentToScore(avg));
  }, [newsQ.data]);

  // Composite score per user story
  const composite = useMemo(() => {
    const weights = {
      intrinsicValue: 0.25,
      fundamental: 0.25,
      technical: 0.20,
      sentiment: 0.15,
      analyst: 0.15,
    };
    const sum =
      intrinsicScore * weights.intrinsicValue +
      fundamentalScore * weights.fundamental +
      technicalScore * weights.technical +
      sentimentScore * weights.sentiment +
      analystScore * weights.analyst;
    const rounded = round1(sum);
    let action = "HOLD" as string;
    if (context === "portfolio") {
      if (rounded >= 8.5) action = "BUY MORE";
      else if (rounded >= 7.0) action = "HOLD";
      else if (rounded >= 5.0) action = "REDUCE";
      else action = "SELL";
    } else {
      if (rounded >= 8.5) action = "STRONG BUY";
      else if (rounded >= 7.0) action = "BUY";
      else if (rounded >= 5.0) action = "WATCH";
      else action = "AVOID";
    }
    return { score: rounded, action };
  }, [intrinsicScore, fundamentalScore, technicalScore, sentimentScore, analystScore, context]);

  const isLoading = chartQ.isLoading || fundamentalsQ.isLoading || analystQ.isLoading || intrinsicQ.isLoading || newsQ.isLoading;
  const hasError = chartQ.isError || fundamentalsQ.isError || analystQ.isError || intrinsicQ.isError || newsQ.isError;

  const insights: string[] = [];
  if (chartQ.data?.indicators?.signal) {
    insights.push(`Technical: ${String(chartQ.data.indicators.signal).replace(/_/g, " ")}`);
  }
  if (fundamentalsQ.data?.score?.interpretation) {
    insights.push(`Fundamentals: ${fundamentalsQ.data.score.interpretation}`);
  }
  if (analystQ.data?.scoreInterpretation) {
    insights.push(`Analysts: ${analystQ.data.scoreInterpretation}`);
  }
  if (typeof intrinsicQ.data?.upsidePercent === "number") {
    insights.push(
      `Intrinsic value suggests ${intrinsicQ.data.upsidePercent >= 0 ? "upside" : "downside"} of ${Math.abs(intrinsicQ.data.upsidePercent).toFixed(1)}%`
    );
  }
  if (typeof sentimentScore === "number") {
    insights.push(`News & sentiment score: ${sentimentScore.toFixed(1)}/10`);
  }

  const compositeColor =
    composite.score >= 7 ? "text-up" : composite.score >= 4 ? "text-amber" : "text-dn";
  const verdictLabel =
    context === "portfolio"
      ? composite.action
      : composite.action.replace(/_/g, " ");

  return (
    <div className="space-y-5">
      {/* Chart without technical footer */}
      <PriceChart symbol={symbol} name={name} showSummary={false} currency={currency} />

      {/* Score breakdown — editorial card (3px double top border per DESIGN.md) */}
      <div
        className="rounded-lg border border-border bg-card px-7 pb-7 pt-6"
        style={{ borderTop: "3px double var(--foreground)" }}
      >
        <div className="flex items-center justify-between border-b border-line2 pb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Overview &amp; composite score
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-mut">
            Meridian rating · updated daily
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-mut">Loading overview…</div>
        ) : hasError ? (
          <div className="flex h-20 items-center justify-center text-mut">
            <AlertCircle className="mr-2 h-4 w-4" />
            Some data failed to load
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-14 pt-7 sm:grid-cols-[280px_1fr]">
            <div>
              <div className={cn("font-serif text-[84px] font-medium leading-none", compositeColor)}>
                {composite.score.toFixed(1)}
                <span className="text-[30px] text-mut">/10</span>
              </div>
              <div
                className={cn("mt-[22px] inline-block rotate-[-3deg] px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.2em]", compositeColor)}
                style={{ border: `3px double currentColor` }}
              >
                {verdictLabel}
              </div>
              <div className="mt-4 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                Momentum + quality
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 sm:grid-cols-5">
                <ScoreDimension label="Technical" score={technicalScore} />
                <ScoreDimension label="Fundamental" score={fundamentalScore} />
                <ScoreDimension label="Analysts" score={analystScore} />
                <ScoreDimension label="Intrinsic" score={intrinsicScore} />
                <ScoreDimension label="Sentiment" score={sentimentScore} last />
              </div>

              {insights.length > 0 && (
                <div className="mt-2 border-t border-line2 pt-[18px]">
                  <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-mut">
                    Key insights
                  </div>
                  <div className="max-w-[680px] font-serif text-[15.5px] leading-[1.55] text-sub">
                    {insights.map((insight, i) => (
                      <div
                        key={i}
                        className={cn("flex items-baseline gap-3", i > 0 && "mt-2.5 border-t border-line2 pt-2.5")}
                      >
                        <span className="text-sm text-mut">№{i + 1}</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreDimension({ label, score, last }: { label: string; score: number; last?: boolean }) {
  const color = score >= 7 ? "text-up" : score >= 4 ? "text-amber" : "text-dn";
  return (
    <div className={cn("pb-[18px] pr-5", !last && "border-r border-line2")}>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">{label}</div>
      <div className={cn("mt-1.5 font-serif text-[28px]", color)}>{score.toFixed(1)}</div>
    </div>
  );
}

