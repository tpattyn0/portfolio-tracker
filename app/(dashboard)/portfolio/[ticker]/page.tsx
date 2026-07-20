"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Overview } from "@/components/overview";
import { TransactionsTab } from "@/components/research/transactions-tab";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { IntrinsicValue } from "@/components/intrinsic-value";
import { AnalystRatings } from "@/components/analyst-ratings";
import { NewsFeed } from "@/components/news-feed";
import { SellPositionModal } from "@/components/sell-position-modal";
import { BuyMoreModal } from "@/components/buy-more-modal";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { formatCurrency, formatPercent, formatCompactCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { shouldShowPositionsTab } from "@/lib/utils/positions-tab";

const ALL_TABS = [
  { value: "overview", label: "Overview" },
  { value: "technical", label: "Technical" },
  { value: "fundamental", label: "Fundamental" },
  { value: "analyst", label: "Analysts" },
  { value: "intrinsic", label: "Intrinsic value" },
  { value: "news", label: "News & sentiment" },
  { value: "transactions", label: "Positions" },
] as const;

type TabValue = (typeof ALL_TABS)[number]["value"];

export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isBuyMoreModalOpen, setIsBuyMoreModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("overview");

  // Fix hydration by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const ticker = params.ticker as string;

  // Fetch position data
  const { data: position, isLoading: positionLoading } = useQuery({
    queryKey: ["position", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/positions/${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch position");
      return res.json();
    },
    enabled: mounted && !!ticker,
  });

  // Fetch live market data
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/market/quote/${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    enabled: mounted && !!ticker,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch news data for sentiment analysis
  const { 
    data: newsArticles, 
    isLoading: newsLoading,
    refetch: refetchNews 
  } = useQuery({
    queryKey: ["news", ticker, position?.name],
    queryFn: async () => {
      // Pass company name to improve relevance
      const params = new URLSearchParams({
        analyze: 'true',
        limit: '20'
      });
      if (position?.name) {
        params.append('name', position.name);
      }
      
      const res = await fetch(`/api/news/${ticker}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    enabled: mounted && !!ticker && !!position,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // "Has or had a position" signal for the Positions tab's conditional
  // visibility (plan Assumption A1) — same has-transactions guard as
  // research/[symbol]/page.tsx, applied here for consistency even though
  // this route is only ever reached for a ticker with a position.
  const { data: transactions } = useQuery({
    queryKey: ["transactions", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/transactions?ticker=${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: mounted && !!ticker,
    staleTime: 5 * 60 * 1000,
  });
  const showPositionsTab = shouldShowPositionsTab(transactions);
  const tabs = ALL_TABS.filter((tab) => tab.value !== "transactions" || showPositionsTab);

  // Defensive fallback derived at render time: if the active tab is ever no
  // longer in the visible set, fall back to Overview rather than rendering a
  // selected-but-hidden tab with no matching button (mirrors
  // research/[symbol]/page.tsx; PT-S1, reviews/2026-07-19-positions-tab.md).
  const effectiveTab = tabs.some((tab) => tab.value === activeTab) ? activeTab : "overview";

  // Delete position mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portfolio/positions/${ticker}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete position");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      router.push("/dashboard");
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this position? This will remove all transaction history.")) {
      deleteMutation.mutate();
    }
  };

  const handleRefreshNews = async () => {
    setIsRefreshingNews(true);
    await refetchNews();
    setTimeout(() => setIsRefreshingNews(false), 1000);
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  if (positionLoading || quoteLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mut" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="py-12 text-center">
        <h2 className="font-serif text-2xl font-medium">Position not found</h2>
        <p className="mt-2 text-mut">The position you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  // Get base currency from position (converted by API)
  const baseCurrency = position.baseCurrency || 'EUR';

  // Calculate real-time metrics with fallbacks
  // Note: quote prices need to be converted if position is in different currency
  let currentPrice = position.currentPrice || 0;
  if (quote?.price) {
    // Apply conversion rate to quote price if available
    currentPrice = quote.price * (position.conversionRate || 1);
  }

  const marketValue = position.quantity * currentPrice;

  return (
    <div>
      {/* Header — Research-detail company header pattern (DESIGN.md "Position
          detail" / plan Task 7): serif 52px company name over a
          TICKER · EXCHANGE-style kicker, pill action buttons. */}
      <Link href="/dashboard" className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
        ← Back to dashboard
      </Link>

      <div className="my-[18px] mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[52px] font-medium leading-[1.05]">{position.name}</h1>
          <div className="mt-2 text-[10.5px] uppercase tracking-[0.14em] text-mut">
            {position.ticker}
            {quote?.exchange ? ` · ${quote.exchange}` : ""}
          </div>
        </div>
        <div className="flex gap-3">
          {position.quantity > 0 && (
            <>
              <button
                type="button"
                onClick={() => setIsBuyMoreModalOpen(true)}
                className="flex h-[38px] items-center rounded-full border border-line px-5 text-[13px] font-medium text-foreground"
              >
                Buy more
              </button>
              <button
                type="button"
                onClick={() => setIsSellModalOpen(true)}
                className="flex h-[38px] items-center rounded-full border border-line px-5 text-[13px] font-medium text-foreground"
              >
                Sell
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex h-[38px] items-center rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Quote card — general market grid (plan Task 2 / ADR-18): spec parity
          with research/[symbol]/page.tsx's 4-col ruled quote grid (Current
          price / Day range / 52-week range / Market cap), fed by the same
          `quote` this page already fetches. The former position-centric grid
          (Market value / Unrealized P/L / Realized P/L / Today's change / Avg
          cost) has moved into the Positions tab's stat band. */}
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

      {/* Tab bar — Research-detail Segmented tabs pattern (DESIGN.md "Position
          detail" / "Segmented tabs"). Tab bodies keep rendering the existing
          shared Meridian tab components unchanged below. */}
      <div className="mb-5 flex gap-8 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "cursor-pointer pb-3 text-[11px] uppercase tracking-[0.14em]",
              effectiveTab === tab.value
                ? "border-b-2 border-foreground font-semibold text-foreground"
                : "text-mut"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {effectiveTab === "overview" && (
        <ComponentErrorBoundary name="Overview">
          <Overview symbol={position.ticker} name={position.name} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "technical" && (
        <ComponentErrorBoundary name="Technical Analysis">
          <TechnicalAnalysis symbol={position.ticker} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "fundamental" && (
        <ComponentErrorBoundary name="Fundamental Analysis">
          <FundamentalAnalysis symbol={position.ticker} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "analyst" && (
        <ComponentErrorBoundary name="Analyst Ratings">
          <AnalystRatings symbol={position.ticker} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "intrinsic" && (
        <ComponentErrorBoundary name="Intrinsic Value">
          <IntrinsicValue symbol={position.ticker} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "transactions" && (
        <ComponentErrorBoundary name="Positions">
          <TransactionsTab symbol={position.ticker} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {effectiveTab === "news" && (
        <ComponentErrorBoundary name="News & Sentiment">
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRefreshNews}
                disabled={isRefreshingNews || newsLoading}
                className="flex h-8 items-center rounded-full border border-line px-[18px] text-[13px] font-medium text-foreground disabled:opacity-60"
              >
                {isRefreshingNews ? "Refreshing…" : "Refresh news"}
              </button>
            </div>

            {newsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-mut" />
              </div>
            ) : (
              <NewsFeed symbol={position.ticker} companyName={position.name} articles={newsArticles} />
            )}
          </div>
        </ComponentErrorBoundary>
      )}

      {/* Modals */}
      {position && position.quantity > 0 && (
        <>
          <SellPositionModal
            isOpen={isSellModalOpen}
            onClose={() => setIsSellModalOpen(false)}
            position={{
              id: position.id,
              ticker: position.ticker,
              name: position.name,
              quantity: position.quantity,
              avgCostBasis: position.avgCostBasis,
              currentPrice: currentPrice,
              marketValue: marketValue,
            }}
            quote={quote}
          />

          <BuyMoreModal
            isOpen={isBuyMoreModalOpen}
            onClose={() => setIsBuyMoreModalOpen(false)}
            position={{
              ticker: position.ticker,
              name: position.name,
              quantity: position.quantity,
              avgCostBasis: position.avgCostBasis,
              currentPrice: currentPrice,
            }}
            quote={quote}
          />
        </>
      )}
    </div>
  );
}