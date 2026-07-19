"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2, Plus, Star } from "lucide-react";
import { Overview } from "@/components/overview";
import { AddToWishlistModal } from "@/components/add-to-wishlist-modal";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { formatCurrency, formatPercent, formatCompactCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { shouldShowPositionsTab } from "@/lib/utils/positions-tab";

// Only the Overview tab (the default active tab, plan Task 9) is a static
// import — the other six tabs are not needed until a user clicks them, so
// their JS is deferred out of the initial route bundle via next/dynamic.
// No SSR needed: all tabs are already client-only ("use client" page) and
// gated behind activeTab state, so there is no first-paint content to lose
// by disabling server rendering for them.
const TechnicalAnalysis = dynamic(
  () => import("@/components/technical-analysis").then((m) => m.TechnicalAnalysis),
  { ssr: false }
);
const FundamentalAnalysis = dynamic(
  () => import("@/components/fundamental-analysis").then((m) => m.FundamentalAnalysis),
  { ssr: false }
);
const AnalystRatings = dynamic(
  () => import("@/components/analyst-ratings").then((m) => m.AnalystRatings),
  { ssr: false }
);
const IntrinsicValue = dynamic(
  () => import("@/components/intrinsic-value").then((m) => m.IntrinsicValue),
  { ssr: false }
);
const TransactionsTab = dynamic(
  () => import("@/components/research/transactions-tab").then((m) => m.TransactionsTab),
  { ssr: false }
);
const NewsFeed = dynamic(
  () => import("@/components/news-feed").then((m) => m.NewsFeed),
  { ssr: false }
);

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

export default function ResearchStockPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [quote, setQuote] = useState<any>(null);
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
    } catch (error) {
      console.error("Error fetching stock data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ownership signal for the Overview tab's context-aware verdict labels
  // (MRD-Q1): reuses the same positions lookup the Transactions tab already
  // makes — 404 means not held — rather than adding a new data path.
  const positionQ = useQuery({
    queryKey: ["position", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/positions/${symbol}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch position");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });
  const overviewContext: "portfolio" | "wishlist" = positionQ.data ? "portfolio" : "wishlist";

  // "Has or had a position" signal for the Positions tab's conditional
  // visibility (plan Assumption A1) — transactions existing for the ticker,
  // not merely a live Position record (a fully-sold position keeps its
  // transactions; only Delete removes both, which correctly hides the tab).
  const transactionsQ = useQuery({
    queryKey: ["transactions", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/transactions?ticker=${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });
  const showPositionsTab = shouldShowPositionsTab(transactionsQ.data);
  const tabs = ALL_TABS.filter((tab) => tab.value !== "transactions" || showPositionsTab);

  // Defensive fallback derived at render time: if the active tab is ever no
  // longer in the visible set (e.g. the Positions tab disappears), fall back
  // to Overview rather than rendering a selected-but-hidden tab with no
  // matching button. Deriving this during render (rather than correcting
  // `activeTab` state after commit in a useEffect) removes the one-render
  // window where the stale `activeTab` briefly has no matching tab button
  // (PT-S1, reviews/2026-07-19-positions-tab.md).
  const effectiveTab = tabs.some((tab) => tab.value === activeTab) ? activeTab : "overview";

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
            {/* Sector clause omitted — not in the quote payload today (TD-DTL-SECTOR). */}
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
              effectiveTab === tab.value
                ? "border-b-2 border-foreground font-semibold text-foreground"
                : "text-mut"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ComponentErrorBoundary name="Research detail">
        <div>
          {effectiveTab === "overview" && quote && (
            <Overview
              symbol={symbol}
              name={quote.name}
              currentPrice={quote.price}
              context={overviewContext}
              currency={quote.currency}
            />
          )}

          {effectiveTab === "technical" && (
            <TechnicalAnalysis symbol={symbol} currency={quote?.currency} />
          )}

          {effectiveTab === "fundamental" && (
            <FundamentalAnalysis symbol={symbol} currency={quote?.currency} />
          )}

          {effectiveTab === "analyst" && (
            <AnalystRatings symbol={symbol} currentPrice={quote?.price} currency={quote?.currency} />
          )}

          {effectiveTab === "intrinsic" && quote && (
            <IntrinsicValue symbol={symbol} currentPrice={quote.price} currency={quote.currency} />
          )}

          {effectiveTab === "transactions" && (
            <TransactionsTab symbol={symbol} currency={quote?.currency} />
          )}

          {effectiveTab === "news" && <NewsFeed symbol={symbol} companyName={quote?.name} />}
        </div>
      </ComponentErrorBoundary>
    </div>
  );
}
