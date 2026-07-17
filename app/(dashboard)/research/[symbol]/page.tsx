"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Star } from "lucide-react";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { IntrinsicValue } from "@/components/intrinsic-value";
import { Overview } from "@/components/overview";
import { AnalystRatings } from "@/components/analyst-ratings";
import { NewsFeed } from "@/components/news-feed";
import { AddToWishlistModal } from "@/components/add-to-wishlist-modal";
import { formatCurrency, formatPercent, formatCompactCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "technical", label: "Technical" },
  { value: "fundamental", label: "Fundamental" },
  { value: "analyst", label: "Analysts" },
  { value: "intrinsic", label: "Intrinsic value" },
  { value: "news", label: "News & sentiment" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

export default function ResearchStockPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [quote, setQuote] = useState<any>(null);
  const [fundamentals, setFundamentals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("overview");

  useEffect(() => {
    if (symbol) {
      fetchStockData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const quoteRes = await fetch(`/api/market/quote/${symbol}`);
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        setQuote(quoteData);
      }

      const fundamentalRes = await fetch(`/api/market/fundamentals/${symbol}`);
      if (fundamentalRes.ok) {
        const fundamentalData = await fundamentalRes.json();
        setFundamentals(fundamentalData);
      }
    } catch (error) {
      console.error("Error fetching stock data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mut" />
      </div>
    );
  }

  return (
    <div>
      <Link href="/research" className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
        ← The research desk
      </Link>

      <div className="my-[18px] mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[52px] font-medium leading-[1.05]">
            {quote?.name || symbol}
          </h1>
          <div className="mt-2 text-[10.5px] uppercase tracking-[0.14em] text-mut">
            {symbol}
            {quote?.exchange ? ` · ${quote.exchange}` : ""}
          </div>
        </div>
        <div className="flex gap-3">
          <AddToWishlistModal
            defaultTicker={symbol}
            trigger={
              <button
                type="button"
                className="flex h-[38px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-[13px] font-medium text-foreground"
              >
                <Star className="h-3.5 w-3.5" /> Watchlist
              </button>
            }
          />
          <Link
            href={`/portfolio/add?ticker=${symbol}`}
            className="flex h-[38px] items-center gap-1.5 rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg"
          >
            <Plus className="h-3.5 w-3.5" /> Add to portfolio
          </Link>
        </div>
      </div>

      {quote && (
        <div className="mb-5 grid grid-cols-4 rounded-lg border border-border bg-card">
          <div className="border-r border-line2 px-7 py-[22px]">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Current price
            </div>
            <div className="mt-1.5 font-serif text-[28px]">
              {formatCurrency(quote.price, quote.currency)}
            </div>
            <div className={cn("mt-0.5 text-[12.5px]", quote.change >= 0 ? "text-up" : "text-dn")}>
              {quote.change >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(quote.change), quote.currency)} (
              {formatPercent(quote.changePercent * 100)})
            </div>
          </div>
          <div className="border-r border-line2 px-7 py-[22px]">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Day range</div>
            <div className="mt-2.5 font-serif text-[22px]">
              {formatCurrency(quote.dayLow, quote.currency)} – {formatCurrency(quote.dayHigh, quote.currency)}
            </div>
          </div>
          <div className="border-r border-line2 px-7 py-[22px]">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">52-week range</div>
            <div className="mt-2.5 font-serif text-[22px]">
              {formatCurrency(quote.yearLow, quote.currency)} – {formatCurrency(quote.yearHigh, quote.currency)}
            </div>
          </div>
          <div className="px-7 py-[22px]">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Market cap</div>
            <div className="mt-2.5 font-serif text-[22px]">
              {quote.marketCap ? formatCompactCurrency(quote.marketCap, quote.currency) : "—"}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex gap-8 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "cursor-pointer pb-3 text-[11px] uppercase tracking-[0.14em]",
              activeTab === tab.value
                ? "border-b-2 border-foreground font-semibold text-foreground"
                : "text-mut"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "overview" && quote && (
          <Overview
            symbol={symbol}
            name={quote.name}
            currentPrice={quote.price}
            context="wishlist"
            currency={quote.currency}
          />
        )}

        {activeTab === "technical" && (
          <TechnicalAnalysis symbol={symbol} currency={quote?.currency} />
        )}

        {activeTab === "fundamental" && (
          <FundamentalAnalysis symbol={symbol} currency={quote?.currency} />
        )}

        {activeTab === "analyst" && (
          <AnalystRatings symbol={symbol} currency={quote?.currency} />
        )}

        {activeTab === "intrinsic" && (
          <div className="space-y-5">
            {quote && (
              <IntrinsicValue symbol={symbol} currentPrice={quote.price} currency={quote.currency} />
            )}

            {fundamentals && (
              <div className="rounded-lg border border-border bg-card px-7 py-6">
                <div className="mb-4 font-serif text-xl">Comparative valuation metrics</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ValuationMetric
                    label="P/E ratio"
                    value={fundamentals.peRatio?.toFixed(2)}
                    caption={
                      fundamentals.industryAvgPE
                        ? `Industry avg: ${fundamentals.industryAvgPE.toFixed(2)}`
                        : undefined
                    }
                  />
                  <ValuationMetric
                    label="PEG ratio"
                    value={fundamentals.pegRatio?.toFixed(2)}
                    caption={
                      fundamentals.pegRatio
                        ? fundamentals.pegRatio < 1
                          ? "Potentially undervalued"
                          : fundamentals.pegRatio > 2
                          ? "Potentially overvalued"
                          : "Fair valued"
                        : undefined
                    }
                  />
                  <ValuationMetric
                    label="P/B ratio"
                    value={fundamentals.pbRatio?.toFixed(2)}
                    caption={
                      fundamentals.industryAvgPB
                        ? `Industry avg: ${fundamentals.industryAvgPB.toFixed(2)}`
                        : undefined
                    }
                  />
                  <ValuationMetric label="P/S ratio" value={fundamentals.psRatio?.toFixed(2)} />
                  <ValuationMetric label="EV/EBITDA" value={fundamentals.evToEbitda?.toFixed(2)} />
                  <ValuationMetric label="Price to FCF" value={fundamentals.priceToFCF?.toFixed(2)} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "news" && <NewsFeed symbol={symbol} companyName={quote?.name} />}
      </div>
    </div>
  );
}

function ValuationMetric({
  label,
  value,
  caption,
}: {
  label: string;
  value?: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">{label}</div>
      <div className="mt-1 font-serif text-xl">{value || "—"}</div>
      {caption && <div className="mt-0.5 text-xs text-mut">{caption}</div>}
    </div>
  );
}
