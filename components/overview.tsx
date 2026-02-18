"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/price-chart";
import { cn } from "@/lib/utils";
import { AlertCircle, BarChart3, Brain, Calculator, LineChart, CheckCircle2, Eye, XCircle, PlusCircle } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Chart without technical footer */}
      <PriceChart symbol={symbol} name={name} showSummary={false} currency={currency} />

      {/* Composite Score (no progress bar) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Overview & Composite Score
            </span>
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-3xl font-bold",
                composite.score >= 8.5 ? "text-green-600" : composite.score >= 7 ? "text-emerald-700" : composite.score >= 5 ? "text-yellow-600" : "text-red-600"
              )}>
                {composite.score.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">/10</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-gray-500">
              Loading overview...
            </div>
          ) : hasError ? (
            <div className="flex items-center justify-center h-20 text-gray-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              Some data failed to load
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
                  <CategoryScore label="Technical" score={technicalScore} icon={<LineChart className="h-4 w-4" />} />
                  <CategoryScore label="Fundamental" score={fundamentalScore} icon={<BarChart3 className="h-4 w-4" />} />
                  <CategoryScore label="Analyst" score={analystScore} icon={<Brain className="h-4 w-4" />} />
                  <CategoryScore label="Intrinsic" score={intrinsicScore} icon={<Calculator className="h-4 w-4" />} />
                  <CategoryScore label="Sentiment" score={sentimentScore} icon={<Brain className="h-4 w-4" />} />
                </div>
                <div className="ml-4 whitespace-nowrap">
                  {renderActionPill(composite.action, context)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights from categories */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {/* Technical */}
            {chartQ.data?.indicators?.signal && (
              <li>
                Technical: {String(chartQ.data.indicators.signal).replace(/_/g, " ")}
              </li>
            )}
            {/* Fundamental */}
            {fundamentalsQ.data?.score?.interpretation && (
              <li>
                Fundamentals: {fundamentalsQ.data.score.interpretation}
              </li>
            )}
            {/* Analyst */}
            {analystQ.data?.scoreInterpretation && (
              <li>
                Analysts: {analystQ.data.scoreInterpretation}
              </li>
            )}
            {/* Intrinsic */}
            {typeof intrinsicQ.data?.upsidePercent === "number" && (
              <li>
                Intrinsic value suggests {intrinsicQ.data.upsidePercent >= 0 ? "upside" : "downside"} of {Math.abs(intrinsicQ.data.upsidePercent).toFixed(1)}%
              </li>
            )}
            {/* Sentiment */}
            {typeof sentimentScore === "number" && (
              <li>
                News & Sentiment score: {sentimentScore.toFixed(1)}/10
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryScore({ label, score, icon }: { label: string; score: number; icon?: React.ReactNode }) {
  const color = score >= 7 ? "text-green-600 bg-green-50" : score >= 5 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return (
    <div className={cn("p-3 rounded-lg text-center", color.split(" ")[1])}>
      {icon}
      <p className="text-xs text-gray-600 mt-1">{label}</p>
      <p className={cn("text-lg font-bold", color.split(" ")[0])}>{score.toFixed(1)}</p>
    </div>
  );
}

function renderActionPill(action: string, context: "portfolio" | "wishlist") {
  // Map action to styles and icon
  let classes = "";
  let Icon: React.ComponentType<{ className?: string }> = CheckCircle2;
  switch (action) {
    case "BUY MORE":
    case "STRONG BUY":
      classes = "bg-green-600 text-white";
      Icon = PlusCircle;
      break;
    case "HOLD":
    case "BUY":
      classes = "bg-emerald-600 text-white";
      Icon = CheckCircle2;
      break;
    case "REDUCE":
    case "WATCH":
      classes = "bg-orange-500 text-white";
      Icon = Eye;
      break;
    case "SELL":
    case "AVOID":
      classes = "bg-red-600 text-white";
      Icon = XCircle;
      break;
    default:
      classes = "bg-gray-600 text-white";
      Icon = CheckCircle2;
  }

  return (
    <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-sm", classes)}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-semibold">{action}</span>
      <span className="ml-2 text-[10px] uppercase opacity-80">{context}</span>
    </div>
  );
}
