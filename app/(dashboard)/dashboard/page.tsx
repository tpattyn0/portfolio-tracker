"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PortfolioChart } from "@/components/portfolio-chart";
import { PositionsTable } from "@/components/positions-table";
import { PortfolioInsights } from "@/components/portfolio-insights";
import { CurrencySelector } from "@/components/currency-selector";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { usePriceSync } from "@/hooks/use-price-sync";

interface Position {
  id: string;
  ticker: string;
  name: string;
  exchange?: string;
  quantity: number;
  marketValue: number;
  marketValueInBaseCurrency?: number;
  unrealizedPLPercent: number;
  currency?: string;
}

export default function DashboardPage() {
  usePriceSync();

  const [baseCurrency, setBaseCurrency] = useState<string>("EUR");

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio", baseCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?baseCurrency=${baseCurrency}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: currencyData } = useQuery({
    queryKey: ["portfolioCurrency"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/currency");
      if (!res.ok) return { baseCurrency: "EUR" };
      return res.json();
    },
  });

  useEffect(() => {
    if (currencyData?.baseCurrency) {
      setBaseCurrency(currencyData.baseCurrency);
    }
  }, [currencyData]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const positions: Position[] = portfolio?.positions ?? [];
  const hasPositions = positions.length > 0;

  const bestPerformer = hasPositions
    ? positions.reduce((best, p) => (p.unrealizedPLPercent > best.unrealizedPLPercent ? p : best))
    : null;

  const largestHolding = hasPositions
    ? positions.reduce((largest, p) => {
        const pValue = p.marketValueInBaseCurrency ?? p.marketValue;
        const largestValue = largest.marketValueInBaseCurrency ?? largest.marketValue;
        return pValue > largestValue ? p : largest;
      })
    : null;

  const largestHoldingValue = largestHolding
    ? largestHolding.marketValueInBaseCurrency ?? largestHolding.marketValue
    : 0;
  const largestHoldingPct =
    largestHolding && portfolio?.totalValue > 0
      ? (largestHoldingValue / portfolio.totalValue) * 100
      : 0;

  const asOf = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      {/* Hero */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-9">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-mut">Portfolio value</div>
          <div className="mt-2.5 font-serif text-[54px] font-medium leading-[1.05]">
            {formatCurrency(portfolio?.totalValue || 0, baseCurrency)}
          </div>
          <div className="mt-3.5 flex items-baseline gap-7 text-[14.5px]">
            <span className={cn(portfolio?.dayChange >= 0 ? "text-up" : "text-dn")}>
              {portfolio?.dayChange >= 0 ? "▲" : "▼"}{" "}
              {formatCurrency(Math.abs(portfolio?.dayChange || 0), baseCurrency)} (
              {formatPercent(portfolio?.dayChangePercent || 0)}) today
            </span>
            <span className="font-serif italic text-mut">as of {asOf}</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <CurrencySelector currentCurrency={baseCurrency} onCurrencyChange={setBaseCurrency} />
          <Link
            href="/portfolio/add"
            className="flex h-10 items-center rounded-full bg-btnbg px-6 text-[13px] font-medium text-btnfg"
          >
            + Add position
          </Link>
        </div>
      </div>

      {/* Ruled stat band */}
      <div className="mb-11 grid grid-cols-3 border-y border-border">
        <div className="py-[18px] pb-5 pr-12">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Total return</div>
          <div
            className={cn(
              "mt-2 font-serif text-[26px] font-medium",
              portfolio?.totalReturn >= 0 ? "text-up" : "text-dn"
            )}
          >
            {portfolio?.totalReturn >= 0 && "+"}
            {formatCurrency(portfolio?.totalReturn || 0, baseCurrency)}
          </div>
          <div
            className={cn(
              "mt-[3px] text-xs",
              portfolio?.totalReturnPercent >= 0 ? "text-up" : "text-dn"
            )}
          >
            {formatPercent(portfolio?.totalReturnPercent || 0)} all time
          </div>
        </div>
        <div className="border-l border-line2 px-12 py-[18px] pb-5">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Best performer</div>
          {bestPerformer ? (
            <>
              <div className="mt-2 truncate font-serif text-[26px] font-medium">
                {bestPerformer.name}
              </div>
              <div className="mt-[3px] text-xs tracking-[0.08em] text-mut">
                {bestPerformer.ticker} ·{" "}
                <span className={bestPerformer.unrealizedPLPercent >= 0 ? "text-up" : "text-dn"}>
                  {formatPercent(bestPerformer.unrealizedPLPercent)}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 font-serif text-[26px] font-medium text-mut">—</div>
          )}
        </div>
        <div className="border-l border-line2 py-[18px] pb-5 pl-12">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Largest holding</div>
          {largestHolding ? (
            <>
              <div className="mt-2 truncate font-serif text-[26px] font-medium">
                {largestHolding.name}
              </div>
              <div className="mt-[3px] text-xs tracking-[0.08em] text-mut">
                {largestHolding.ticker} · {largestHoldingPct.toFixed(1)}% of portfolio
              </div>
            </>
          ) : (
            <div className="mt-2 font-serif text-[26px] font-medium text-mut">—</div>
          )}
        </div>
      </div>

      {/* Performance chart */}
      {hasPositions && (
        <div className="mb-5 rounded-lg border border-border bg-card px-7 py-6">
          <div className="flex items-center justify-between border-b border-line2 pb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Performance
            </span>
          </div>
          <div className="mt-5">
            <ComponentErrorBoundary name="Performance Chart">
              <PortfolioChart
                positions={portfolio?.positions}
                baseCurrency={baseCurrency}
                exchangeRatesUsed={portfolio?.exchangeRatesUsed}
                totalValue={portfolio?.totalValue}
                totalCost={portfolio?.totalCost}
              />
            </ComponentErrorBoundary>
          </div>
        </div>
      )}

      {/* Positions table */}
      <div className="mb-5 rounded-lg border border-border bg-card px-7 py-6">
        <div className="flex items-center justify-between pb-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Your positions
          </span>
          {hasPositions && (
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-mut">
              {positions.length} holding{positions.length === 1 ? "" : "s"} · click a row for research
            </span>
          )}
        </div>
        {hasPositions ? (
          <ComponentErrorBoundary name="Positions Table">
            <PositionsTable positions={portfolio.positions} baseCurrency={baseCurrency} />
          </ComponentErrorBoundary>
        ) : (
          <div className="py-12 text-center">
            <h3 className="mb-2 font-serif text-lg font-medium">No positions yet</h3>
            <p className="mb-4 text-sub">
              Start building your portfolio by adding your first position
            </p>
            <Link
              href="/portfolio/add"
              className="inline-flex h-10 items-center rounded-full bg-btnbg px-6 text-[13px] font-medium text-btnfg"
            >
              + Add your first position
            </Link>
          </div>
        )}
      </div>

      {/* AI Portfolio Insights — "The Morning Note" */}
      {hasPositions && (
        <ComponentErrorBoundary name="Portfolio Insights">
          <PortfolioInsights />
        </ComponentErrorBoundary>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-9">
        <div>
          <div className="h-3 w-32 rounded bg-fill" />
          <div className="mt-3 h-12 w-64 rounded bg-fill" />
          <div className="mt-4 h-4 w-80 rounded bg-fill" />
        </div>
        <div className="h-10 w-40 rounded-full bg-fill" />
      </div>
      <div className="grid grid-cols-3 gap-8 border-y border-border py-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-fill" />
            <div className="h-7 w-32 rounded bg-fill" />
            <div className="h-3 w-28 rounded bg-fill" />
          </div>
        ))}
      </div>
      <div className="h-[300px] w-full rounded-lg border border-border bg-fill" />
      <div className="h-64 w-full rounded-lg border border-border bg-fill" />
    </div>
  );
}
