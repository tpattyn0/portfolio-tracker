"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Overview } from "@/components/overview";
import { TransactionHistory } from "@/components/transaction-history";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { IntrinsicValue } from "@/components/intrinsic-value";
import { AnalystRatings } from "@/components/analyst-ratings";
import { NewsFeed } from "@/components/news-feed";
import { SentimentScore } from "@/components/sentiment-score";
import { SellPositionModal } from "@/components/sell-position-modal";
import { BuyMoreModal } from "@/components/buy-more-modal";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "technical", label: "Technical" },
  { value: "fundamental", label: "Fundamental" },
  { value: "analyst", label: "Analysts" },
  { value: "intrinsic", label: "Intrinsic value" },
  { value: "transactions", label: "Transactions" },
  { value: "news", label: "News & sentiment" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

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
  const totalCost = position.quantity * position.avgCostBasis;
  const unrealizedPL = marketValue - totalCost;
  const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
  const dayChange = quote ? (quote.change || 0) * position.quantity * (position.conversionRate || 1) : 0;
  const dayChangePercent = quote?.changePercent ? quote.changePercent * 100 : 0;
  const totalPL = unrealizedPL + (position.realizedPL || 0);
  
  const hasRealizedPL = position.realizedPL !== undefined && position.realizedPL !== 0;

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
            {position.quantity === 0 && " · Position closed"}
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

      {/* Quote card — Research-detail 4-col ruled quote grid pattern, extended
          to 5 columns for this page's own metrics (DESIGN.md "Position
          detail"): kicker / serif value / detail line per cell, --line2
          internal verticals, signed figures via --up/--dn aliases. */}
      <div
        className={cn(
          "mb-5 grid rounded-lg border border-border bg-card",
          hasRealizedPL ? "grid-cols-5" : "grid-cols-4"
        )}
      >
        <div className="border-r border-line2 px-7 py-[22px]">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Market value</div>
          <div className="mt-1.5 font-serif text-[28px]">{formatCurrency(marketValue, baseCurrency)}</div>
          <div className="mt-0.5 text-[12.5px] text-mut">
            {formatNumber(position.quantity)} shares @ {formatCurrency(currentPrice, baseCurrency)}
          </div>
        </div>
        <div className="border-r border-line2 px-7 py-[22px]">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Unrealized P/L</div>
          <div className={cn("mt-1.5 font-serif text-[28px]", unrealizedPL >= 0 ? "text-up" : "text-dn")}>
            {unrealizedPL >= 0 && "+"}
            {formatCurrency(unrealizedPL, baseCurrency)}
          </div>
          <div className={cn("mt-0.5 text-[12.5px]", unrealizedPLPercent >= 0 ? "text-up" : "text-dn")}>
            {formatPercent(unrealizedPLPercent)}
          </div>
        </div>
        {hasRealizedPL && (
          <div className="border-r border-line2 px-7 py-[22px]">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Realized P/L</div>
            <div className={cn("mt-1.5 font-serif text-[28px]", position.realizedPL >= 0 ? "text-up" : "text-dn")}>
              {position.realizedPL >= 0 && "+"}
              {formatCurrency(position.realizedPL, baseCurrency)}
            </div>
            <div className="mt-0.5 text-[12.5px] text-mut">From previous sales</div>
          </div>
        )}
        <div className="border-r border-line2 px-7 py-[22px]">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Today&apos;s change</div>
          <div className={cn("mt-1.5 font-serif text-[28px]", dayChange >= 0 ? "text-up" : "text-dn")}>
            {dayChange >= 0 && "+"}
            {formatCurrency(dayChange, baseCurrency)}
          </div>
          <div className={cn("mt-0.5 text-[12.5px]", dayChangePercent >= 0 ? "text-up" : "text-dn")}>
            {formatPercent(dayChangePercent)}
          </div>
        </div>
        <div className="px-7 py-[22px]">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Avg cost</div>
          <div className="mt-1.5 font-serif text-[28px]">{formatCurrency(position.avgCostBasis, baseCurrency)}</div>
          <div className="mt-0.5 text-[12.5px] text-mut">
            First buy: {new Date(position.firstBuyDate || position.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

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
              activeTab === tab.value
                ? "border-b-2 border-foreground font-semibold text-foreground"
                : "text-mut"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <ComponentErrorBoundary name="Overview">
          <Overview symbol={position.ticker} name={position.name} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "technical" && (
        <ComponentErrorBoundary name="Technical Analysis">
          <TechnicalAnalysis symbol={position.ticker} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "fundamental" && (
        <ComponentErrorBoundary name="Fundamental Analysis">
          <FundamentalAnalysis symbol={position.ticker} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "analyst" && (
        <ComponentErrorBoundary name="Analyst Ratings">
          <AnalystRatings symbol={position.ticker} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "intrinsic" && (
        <ComponentErrorBoundary name="Intrinsic Value">
          <IntrinsicValue symbol={position.ticker} currentPrice={currentPrice} currency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "transactions" && (
        <ComponentErrorBoundary name="Transaction History">
          <TransactionHistory positionId={position.id} baseCurrency={baseCurrency} />
        </ComponentErrorBoundary>
      )}

      {activeTab === "news" && (
        <ComponentErrorBoundary name="News & Sentiment">
          <div className="space-y-5">
            {newsArticles && newsArticles.length > 0 && (
              <SentimentScore articles={newsArticles} symbol={position.ticker} />
            )}

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