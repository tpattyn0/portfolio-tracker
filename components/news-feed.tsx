"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle } from "lucide-react";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { MIN_CONFIDENT_SAMPLE, calibratedSentimentToScore, dampenForSample, round1 } from "@/lib/utils/research-scores";
import { cn } from "@/lib/utils";

interface NewsArticle {
  id: string;
  title: string;
  summary?: string | null;
  url: string;
  source: string;
  publishedAt: string | Date;
  sentiment?: number | null;
  sentimentLabel?: string | null;
  impact?: string | null;
  relevanceScore?: number | null;
}

interface NewsFeedProps {
  symbol: string;
  companyName?: string;
  articles?: NewsArticle[];
}

function sentimentTag(sentiment: number | null | undefined): { label: string; color: string } {
  if (sentiment === null || sentiment === undefined) return { label: "PENDING", color: "text-mut" };
  if (sentiment > 0.2) return { label: "POSITIVE", color: "text-up" };
  if (sentiment < -0.2) return { label: "NEGATIVE", color: "text-dn" };
  return { label: "NEUTRAL", color: "text-mut" };
}

export function NewsFeed({ symbol, companyName, articles: propArticles }: NewsFeedProps) {
  const { data: fetchedArticles, isLoading } = useQuery({
    queryKey: ["news", symbol, companyName],
    queryFn: async () => {
      const params = new URLSearchParams({ analyze: "true", limit: "20" });
      if (companyName) params.append("name", companyName);

      const res = await fetch(`/api/news/${symbol}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json() as Promise<NewsArticle[]>;
    },
    enabled: !propArticles,
    refetchInterval: 5 * 60 * 1000,
  });

  const allNews = propArticles || fetchedArticles || [];
  const news = allNews.filter((a) => (a.relevanceScore ?? 1) >= 0.5);

  const { score, positivePct, neutralPct, negativePct, analysedCount } = useMemo(() => {
    const analyzed = news.filter((a) => a.sentiment !== null && a.sentiment !== undefined);
    if (analyzed.length === 0) {
      return { score: 5, positivePct: 0, neutralPct: 0, negativePct: 0, analysedCount: 0 };
    }

    let weighted = 0;
    let totalW = 0;
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    for (const a of analyzed) {
      const s = a.sentiment ?? 0;
      let w = 1;
      if (a.impact === "high") w = 3;
      else if (a.impact === "medium") w = 2;
      const rel = a.relevanceScore ?? 0.5;
      const weight = w * rel;
      weighted += s * weight;
      totalW += weight;

      if (s > 0.2) positive++;
      else if (s < -0.2) negative++;
      else neutral++;
    }

    const avg = totalW > 0 ? weighted / totalW : 0;
    // Calibrated, sample-damped map (plans/2026-07-24-news-sentiment-accuracy.md,
    // Task 11) — must stay identical to overview.tsx's/wishlist.service.ts's
    // maps for the same weighted-average sentiment + analysed count, so the
    // News tab and the Overview composite cannot silently disagree.
    return {
      score: round1(dampenForSample(calibratedSentimentToScore(avg), analyzed.length)),
      positivePct: Math.round((positive / analyzed.length) * 100),
      neutralPct: Math.round((neutral / analyzed.length) * 100),
      negativePct: Math.round((negative / analyzed.length) * 100),
      analysedCount: analyzed.length,
    };
  }, [news]);

  // Thin-sample honesty (plans/2026-07-24-news-sentiment-accuracy.md, Task 12,
  // DESIGN.md "Thin-sample honesty"). The WARMING/STEADY/COOLING word is
  // derived from the already-damped `score` — no separate thin-sample
  // vocabulary, so a damped thin-sample score in the 4-7 band already reads
  // "Steady," which is the honest word for it. `trendBanded` is forced false
  // on a thin sample regardless of what the damped score's band would
  // otherwise imply — the kicker's bold `--up` color is reserved for "this is
  // a well-founded reading," which a thin sample is not, by definition.
  const isThinSample = analysedCount > 0 && analysedCount < MIN_CONFIDENT_SAMPLE;
  const trendKicker = score >= 7 ? "Warming" : score >= 4 ? "Steady" : "Cooling";
  const trendBanded = score >= 7 && !isThinSample;

  if (isLoading && !propArticles) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        Loading news &amp; sentiment…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HeadlineScoreCard
        kicker="News & sentiment"
        metaKicker={`${analysedCount} articles analysed · last 30 days`}
        score={score}
        verdictKicker={trendKicker}
        verdictKickerBanded={trendBanded}
        summary={
          analysedCount === 0
            ? `No recent news coverage found for ${symbol}.`
            : isThinSample
              ? `Sentiment reflects only ${analysedCount} analysed article${analysedCount === 1 ? "" : "s"} — too few for a confident reading. Score shown is weighted toward neutral.`
              : `Sentiment reflects ${analysedCount} analysed articles, weighted by relevance and market impact.`
        }
      >
        <div className="grid grid-cols-3 pt-5">
          <ToneCell label="Positive" pct={positivePct} color="text-up" />
          <ToneCell label="Neutral" pct={neutralPct} color="text-mut" />
          <ToneCell label="Negative" pct={negativePct} color="text-dn" />
        </div>
        {/* MoM delta omitted — TD-DTL-TONE: SentimentHistory lacks a clean prior-30-day baseline. */}
      </HeadlineScoreCard>

      <div className="rounded-lg border border-border bg-card px-7 pb-7 pt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Latest coverage</div>

        {news.length === 0 ? (
          <div className="mt-5 flex items-center gap-2 font-serif text-[14.5px] italic text-mut">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No recent news found for {symbol}
            {companyName ? ` (${companyName})` : ""}.
          </div>
        ) : (
          <div className="mt-3">
            {news.map((article, i) => {
              const tag = sentimentTag(article.sentiment);
              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex cursor-pointer items-baseline justify-between gap-8 py-[18px] hover:bg-fill",
                    i < news.length - 1 && "border-b border-line2"
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-serif text-[17px] font-medium leading-[1.35]">{article.title}</div>
                    <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                      {article.source} · {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <span className={cn("shrink-0 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.14em]", tag.color)}>
                    {tag.label}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToneCell({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="border-l border-line2 pl-5 first:border-l-0 first:pl-0">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">{label}</div>
      <div className={cn("mt-1.5 font-serif text-[26px]", color)}>{pct}%</div>
    </div>
  );
}
