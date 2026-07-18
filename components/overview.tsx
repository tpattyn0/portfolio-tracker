"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DetailPriceChart } from "@/components/research/detail-price-chart";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { SubscoreBand } from "@/components/research/subscore-band";
import { round1, sentimentToScore, upsideToScore } from "@/lib/utils/research-scores";
import { AlertCircle } from "lucide-react";

interface OverviewProps {
  symbol: string;
  name: string;
  currentPrice: number;
  context?: "portfolio" | "wishlist";
  currency?: string;
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

  const verdictLabel = context === "portfolio" ? composite.action : composite.action.replace(/_/g, " ");

  const dimensionItems = [
    { label: "Technical", score: technicalScore },
    { label: "Fundamental", score: fundamentalScore },
    { label: "Analysts", score: analystScore },
    { label: "Intrinsic", score: intrinsicScore },
    { label: "Sentiment", score: sentimentScore },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card px-7 py-6">
        <DetailPriceChart symbol={symbol} period="1Y" currency={currency} />
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
          Loading overview…
        </div>
      ) : hasError ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
          <AlertCircle className="mr-2 h-4 w-4" />
          Some data failed to load
        </div>
      ) : (
        <HeadlineScoreCard
          kicker="Overview & composite score"
          metaKicker="Meridian rating · updated daily"
          score={composite.score}
          verdictStamp={verdictLabel}
          leftExtra={
            <div className="mt-4 text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Momentum + quality
            </div>
          }
        >
          <SubscoreBand items={dimensionItems} />

          {insights.length > 0 && (
            <div className="mt-2 border-t border-line2 pt-[18px]">
              <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-mut">Key insights</div>
              <div className="max-w-[680px] font-serif text-[15.5px] leading-[1.55] text-sub">
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className={i > 0 ? "mt-2.5 flex items-baseline gap-3 border-t border-line2 pt-2.5" : "flex items-baseline gap-3"}
                  >
                    <span className="text-sm text-mut">№{i + 1}</span>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </HeadlineScoreCard>
      )}
    </div>
  );
}
