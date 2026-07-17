// components/portfolio-insights.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioInsightsData {
  createdAt: string;
  marketSentiment: number;
  marketSummary: string;
  portfolioImpact: string;
  topRisks?: string[];
  opportunities?: string[];
  recommendations?: string[];
}

function getSentimentLabel(sentiment: number): { label: string; symbol: string } {
  if (sentiment > 0.2) return { label: "Positive", symbol: "▲" };
  if (sentiment < -0.2) return { label: "Negative", symbol: "▼" };
  return { label: "Neutral", symbol: "—" };
}

export function PortfolioInsights() {
  const { data: insights, isLoading, refetch, isRefetching } = useQuery<PortfolioInsightsData>({
    queryKey: ["portfolio-insights"],
    queryFn: async () => {
      const res = await fetch("/api/insights/portfolio");
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  if (isLoading) {
    return <PortfolioInsightsSkeleton />;
  }

  if (!insights) {
    return null;
  }

  const sentiment = getSentimentLabel(insights.marketSentiment);
  const summary = insights.marketSummary || "";
  const dropCap = summary.charAt(0);
  const rest = summary.slice(1);
  const refreshTime = insights.createdAt
    ? new Date(insights.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const topRisks = insights.topRisks ?? [];
  const opportunities = insights.opportunities ?? [];
  const recommendations = insights.recommendations ?? [];

  return (
    <div
      className="rounded-lg border border-border bg-card px-7 pb-7 pt-6"
      style={{ borderTop: "3px double var(--foreground)" }}
    >
      <div className="flex items-center justify-between border-b border-line2 pb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
          The Morning Note
        </span>
        <div className="flex items-center gap-[18px] text-[11px] uppercase tracking-[0.1em]">
          <span className="text-mut">Sentiment</span>
          <span
            className={cn(
              "font-semibold",
              insights.marketSentiment > 0.2 && "text-up",
              insights.marketSentiment < -0.2 && "text-dn",
              Math.abs(insights.marketSentiment) <= 0.2 && "text-mut"
            )}
          >
            {sentiment.symbol} {sentiment.label}
          </span>
          <span className="text-mut">·</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh"
            className="text-mut"
          >
            <span className="inline-flex items-center gap-1">
              <RefreshCw className={cn("h-3 w-3", isRefetching && "animate-spin")} />
              {refreshTime}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-12 py-7 pb-3">
        <p className="m-0 font-serif text-[19px] leading-[1.6] text-sub">
          {dropCap && (
            <span className="float-left pr-2.5 pt-1.5 font-serif text-[56px] leading-[0.82] text-foreground">
              {dropCap}
            </span>
          )}
          {rest}
        </p>
        {insights.portfolioImpact && (
          <div className="flex flex-col justify-center border-l border-border pl-8">
            <div className="font-serif text-[17px] italic leading-[1.55] text-sub">
              &ldquo;{insights.portfolioImpact}&rdquo;
            </div>
            <div className="mt-2.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
              — Portfolio impact
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 border-t border-line2">
        <div className="pb-1 pr-8 pt-6">
          <div className="mb-3 border-b border-line2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber">
            ⚠ Top risks
          </div>
          {topRisks.length === 0 ? (
            <div className="font-serif text-[15.5px] leading-[1.5] text-mut">No significant risks identified</div>
          ) : (
            topRisks.map((risk, i) => (
              <div
                key={i}
                className={cn(
                  "font-serif text-[15.5px] leading-[1.5] text-sub",
                  i > 0 && "mt-3 border-t border-line2 pt-3"
                )}
              >
                {risk}
              </div>
            ))
          )}
        </div>
        <div className="border-l border-line2 pb-1 pt-6 px-8">
          <div className="mb-3 border-b border-line2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]">
            ◇ Opportunities
          </div>
          {opportunities.length === 0 ? (
            <div className="font-serif text-[15.5px] leading-[1.5] text-mut">No specific opportunities identified</div>
          ) : (
            opportunities.map((opportunity, i) => (
              <div
                key={i}
                className={cn(
                  "font-serif text-[15.5px] leading-[1.5] text-sub",
                  i > 0 && "mt-3 border-t border-line2 pt-3"
                )}
              >
                {opportunity}
              </div>
            ))
          )}
        </div>
        <div className="border-l border-line2 pb-1 pl-8 pt-6">
          <div className="mb-3 border-b border-line2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-up">
            → Recommendations
          </div>
          {recommendations.map((recommendation, i) => (
            <div
              key={i}
              className={cn(
                "flex items-baseline gap-3",
                i > 0 && "mt-3 border-t border-line2 pt-3"
              )}
            >
              <span className="font-serif text-[15px] text-mut">№{i + 1}</span>
              <span className="font-serif text-[15.5px] leading-[1.5] text-sub">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortfolioInsightsSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-7">
      <div className="mb-4 h-4 w-40 rounded bg-fill" />
      <div className="h-24 w-full rounded bg-fill" />
    </div>
  );
}
