"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

export interface AnalystRatingsData {
  targetPrice: number | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  averageRating: number | null;
  lastUpdated: string;
  score: number;
  scoreInterpretation: string;
}

interface AnalystRatingsProps {
  symbol: string;
  currentPrice?: number;
  initialData?: AnalystRatingsData;
  currency?: string;
}

const DISTRIBUTION_ROWS = [
  { key: "strongBuy", label: "Strong buy", color: "bg-up" },
  { key: "buy", label: "Buy", color: "bg-up/70" },
  { key: "hold", label: "Hold", color: "bg-amber" },
  { key: "sell", label: "Sell", color: "bg-dn/70" },
  { key: "strongSell", label: "Strong sell", color: "bg-dn" },
] as const;

export function AnalystRatings({ symbol, currentPrice, initialData, currency }: AnalystRatingsProps) {
  const [ratings, setRatings] = useState<AnalystRatingsData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRatings = async () => {
      if (initialData) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/market/analyst-ratings/${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch analyst ratings: ${response.statusText}`);
        }
        const data = await response.json();
        setRatings(data);
      } catch (err) {
        console.error("Error fetching analyst ratings:", err);
        setError(err instanceof Error ? err.message : "Failed to load analyst ratings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRatings();
  }, [symbol, initialData]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        Loading analyst ratings…
      </div>
    );
  }

  if (error || !ratings) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        <AlertCircle className="mr-2 h-4 w-4" />
        {error || "Failed to load analyst ratings"}
      </div>
    );
  }

  const totalRatings = ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell;

  let priceDifference: { value: number; formatted: string } | null = null;
  if (currentPrice && ratings.targetPrice) {
    const diff = ((ratings.targetPrice - currentPrice) / currentPrice) * 100;
    priceDifference = { value: diff, formatted: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` };
  }

  const verdictLabel =
    ratings.score >= 7 ? "STRONG BUY" : ratings.score >= 5.5 ? "BUY" : ratings.score >= 4.5 ? "HOLD" : ratings.score >= 3 ? "SELL" : "STRONG SELL";

  return (
    <div className="space-y-5">
      <HeadlineScoreCard
        kicker="Analyst ratings"
        metaKicker={`${totalRatings} analysts · last 90 days`}
        score={ratings.score}
        verdictStamp={verdictLabel}
        leftExtra={
          <div className="mt-4 text-[10.5px] uppercase tracking-[0.12em] text-mut">Street consensus</div>
        }
      >
        <div className="space-y-3">
          {DISTRIBUTION_ROWS.map((row) => {
            const count = ratings[row.key];
            const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            return (
              <div key={row.key} className="flex items-center gap-4">
                <div className="w-24 shrink-0 text-[10.5px] uppercase tracking-[0.1em] text-mut">{row.label}</div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-6 shrink-0 text-right text-[12.5px] text-sub">{count}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-3 border-t border-line pt-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Low</div>
            <div className="mt-1.5 font-serif text-[26px] text-dn">—</div>
          </div>
          <div className="border-l border-line2 pl-5">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Median</div>
            <div className="mt-1.5 font-serif text-[26px]">
              {ratings.targetPrice ? formatCurrency(ratings.targetPrice, currency) : "—"}
            </div>
            {priceDifference && (
              <div className={cn("mt-0.5 text-[12.5px]", priceDifference.value >= 0 ? "text-up" : "text-dn")}>
                {priceDifference.formatted} {priceDifference.value >= 0 ? "upside" : "downside"}
              </div>
            )}
          </div>
          <div className="border-l border-line2 pl-5">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">High</div>
            <div className="mt-1.5 font-serif text-[26px] text-up">—</div>
          </div>
        </div>
      </HeadlineScoreCard>

      <div className="rounded-lg border border-border bg-card px-7 pb-7 pt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Recent revisions</div>
        <p className="mt-5 font-serif text-[14.5px] italic text-mut">
          No recent revisions on file. {/* TD-DTL-REV — upgradeDowngradeHistory is fetched by the
          service but not returned in the analyst-ratings API response. */}
        </p>
      </div>
    </div>
  );
}
