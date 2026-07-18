"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DetailPriceChart } from "@/components/research/detail-price-chart";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { SubscoreBand } from "@/components/research/subscore-band";
import { round1, sentimentToScore, upsideToScore, verdictLabel } from "@/lib/utils/research-scores";

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

  // Derive subscores. Each dimension defaults to a neutral `5` when its query
  // has *resolved with no usable data* (the pre-existing behavior), but
  // reports `null` when its query *errored* — the composite math substitutes
  // a neutral value for a missing input either way (unchanged scoring
  // behavior), but the SubscoreBand/ScoreFigure render an honest `--mut`
  // placeholder for `null` instead of a fabricated `5` (DESIGN.md "Score
  // figure" null/unavailable band). This is presentational-only: no scoring
  // math changes, only what gets displayed for an errored dimension.
  const technicalScore = useMemo(() => {
    if (chartQ.isError) return null;
    const indicators = chartQ.data?.indicators;
    if (!indicators) return 5;
    // Use the actual calculated score from technical analysis instead of mapping signal
    return typeof indicators.score === 'number' ? indicators.score : 5;
  }, [chartQ.data, chartQ.isError]);

  const fundamentalScore = useMemo(() => {
    if (fundamentalsQ.isError) return null;
    const s = fundamentalsQ.data?.score?.total;
    return typeof s === "number" ? s : 5;
  }, [fundamentalsQ.data, fundamentalsQ.isError]);

  const analystScore = useMemo(() => {
    if (analystQ.isError) return null;
    const s = analystQ.data?.score;
    if (typeof s !== "number") return 5;
    return Math.max(0, Math.min(10, s));
  }, [analystQ.data, analystQ.isError]);

  const intrinsicScore = useMemo(() => {
    if (intrinsicQ.isError) return null;
    const up = intrinsicQ.data?.upsidePercent as number | null | undefined;
    return upsideToScore(up);
  }, [intrinsicQ.data, intrinsicQ.isError]);

  const sentimentScore = useMemo(() => {
    if (newsQ.isError) return null;
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
  }, [newsQ.data, newsQ.isError]);

  // Composite score per user story — a `null` (errored) dimension substitutes
  // a neutral 5 in the weighted sum, same as the pre-existing "no data"
  // fallback; the composite math itself is unchanged.
  const composite = useMemo(() => {
    const weights = {
      intrinsicValue: 0.25,
      fundamental: 0.25,
      technical: 0.20,
      sentiment: 0.15,
      analyst: 0.15,
    };
    const sum =
      (intrinsicScore ?? 5) * weights.intrinsicValue +
      (fundamentalScore ?? 5) * weights.fundamental +
      (technicalScore ?? 5) * weights.technical +
      (sentimentScore ?? 5) * weights.sentiment +
      (analystScore ?? 5) * weights.analyst;
    const rounded = round1(sum);
    const action = verdictLabel(rounded, context);
    return { score: rounded, action };
  }, [intrinsicScore, fundamentalScore, technicalScore, sentimentScore, analystScore, context]);

  // Only the chart query (which also drives the price chart) gates the
  // initial full-tab loading state — do not gate the whole card on the
  // slowest of five independent queries (plan Task 4).
  const isLoading = chartQ.isLoading;

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

  const verdictStamp = composite.action;

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
      ) : (
        <HeadlineScoreCard
          kicker="Overview & composite score"
          metaKicker="Meridian rating · updated daily"
          score={composite.score}
          verdictStamp={verdictStamp}
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
