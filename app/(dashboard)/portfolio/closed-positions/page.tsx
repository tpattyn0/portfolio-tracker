"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TickerFilter, TickerOption } from "@/components/closed-positions/ticker-filter";
import Link from "next/link";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface ClosedPosition {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  firstBuyDate: string;
  closeDate: string;
  holdingDays: number;
  totalSharesSold: number;
  avgCostBasis: number;
  avgSellPrice: number;
  realizedPL: number;
  realizedPLPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface Aggregates {
  totalClosedPositions: number;
  totalRealizedPL: number;
  avgHoldingDays: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
}

const outcomeTabs: { value: "all" | "winners" | "losers"; label: string }[] = [
  { value: "all", label: "All trades" },
  { value: "winners", label: "Winning" },
  { value: "losers", label: "Losing" },
];

export default function ClosedPositionsPage() {
  const [sortBy, setSortBy] = useState("closeDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "winners" | "losers">("all");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["closed-positions", sortBy, sortOrder, outcomeFilter, selectedTickers],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(outcomeFilter !== "all" && { outcome: outcomeFilter }),
        ...(selectedTickers.length > 0 && { tickers: selectedTickers.join(",") }),
      });

      const res = await fetch(`/api/portfolio/closed-positions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch closed positions");
      return res.json() as Promise<{
        positions: ClosedPosition[];
        aggregates: Aggregates;
        tickerOptions: TickerOption[];
      }>;
    },
  });

  const { tickerOptions = [] } = data || {};

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleExport = async () => {
    if (!data?.positions) return;

    const csv = [
      ["Ticker", "Name", "First Buy Date", "Close Date", "Holding Days", "Shares Sold", "Avg Cost", "Avg Sell Price", "Realized P/L", "Realized P/L %", "Total Return", "Total Return %"].join(","),
      ...data.positions.map((p) =>
        [
          p.ticker,
          `"${p.name}"`,
          new Date(p.firstBuyDate).toLocaleDateString(),
          new Date(p.closeDate).toLocaleDateString(),
          p.holdingDays,
          p.totalSharesSold,
          p.avgCostBasis.toFixed(2),
          p.avgSellPrice.toFixed(2),
          p.realizedPL.toFixed(2),
          p.realizedPLPercent.toFixed(2),
          p.totalReturn.toFixed(2),
          p.totalReturnPercent.toFixed(2),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closed-positions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const defaultAggregates: Aggregates = {
    totalClosedPositions: 0,
    totalRealizedPL: 0,
    avgHoldingDays: 0,
    winRate: 0,
    avgReturn: 0,
    medianReturn: 0,
  };

  const displayAggregates = data?.aggregates || defaultAggregates;
  const displayPositions = data?.positions || [];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center text-mut">Loading closed positions…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-dn">Error loading closed positions</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-mut">
            The ledger · completed trades
          </div>
          <h1 className="mt-2.5 font-serif text-[52px] font-medium leading-[1.05]">
            Closed positions
          </h1>
          <div className="mt-3.5 flex items-baseline gap-7 text-[14.5px]">
            <span className={cn(displayAggregates.totalRealizedPL >= 0 ? "text-up" : "text-dn")}>
              Realized to date: {displayAggregates.totalRealizedPL >= 0 && "+"}
              {formatCurrency(displayAggregates.totalRealizedPL)}
            </span>
            <span className="font-serif italic text-mut">
              {displayAggregates.totalClosedPositions} trade
              {displayAggregates.totalClosedPositions === 1 ? "" : "s"} settled
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={displayPositions.length === 0}
          className="h-[38px] rounded-full border border-border bg-card px-5 text-[13px] font-medium text-foreground disabled:opacity-50"
        >
          ⤓ Export CSV
        </button>
      </div>

      {/* 6-col summary card */}
      <div className="mb-5 grid grid-cols-6 rounded-lg border border-border bg-card">
        <SummaryCell label="Positions" value={formatNumber(displayAggregates.totalClosedPositions, 0)} />
        <SummaryCell
          label="Realized P/L"
          value={`${displayAggregates.totalRealizedPL >= 0 ? "+" : ""}${formatCurrency(displayAggregates.totalRealizedPL)}`}
          color={displayAggregates.totalRealizedPL >= 0 ? "up" : "dn"}
        />
        <SummaryCell label="Win rate" value={`${Math.round(displayAggregates.winRate * 100)}%`} />
        <SummaryCell
          label="Avg holding"
          value={
            <>
              {Math.round(displayAggregates.avgHoldingDays)}{" "}
              <span className="text-[15px] text-mut">days</span>
            </>
          }
        />
        <SummaryCell
          label="Avg return"
          value={formatPercent(displayAggregates.avgReturn)}
          color={displayAggregates.avgReturn >= 0 ? "up" : "dn"}
        />
        <SummaryCell
          label="Median return"
          value={formatPercent(displayAggregates.medianReturn)}
          color={displayAggregates.medianReturn >= 0 ? "up" : "dn"}
          last
        />
      </div>

      {/* Filter row */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="w-full max-w-[320px]">
          <TickerFilter
            options={tickerOptions}
            selectedValues={selectedTickers}
            onSelect={setSelectedTickers}
            placeholder="Filter by ticker or name…"
          />
        </div>
        <div className="flex gap-[22px] text-[10.5px] uppercase tracking-[0.12em] text-mut">
          {outcomeTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setOutcomeFilter(tab.value)}
              className={cn(
                "cursor-pointer pb-0.5",
                outcomeFilter === tab.value
                  ? "border-b-2 border-foreground font-semibold text-foreground"
                  : "border-b-2 border-transparent"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {displayPositions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <p className="mb-4 text-sub">
            {selectedTickers.length > 0
              ? "No closed positions match the selected filters"
              : "No closed positions yet"}
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="h-10 rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground"
            >
              View Portfolio
            </Link>
            <Link
              href="/research"
              className="h-10 rounded-full bg-btnbg px-5 py-2.5 text-[13px] font-medium text-btnfg"
            >
              Research Stocks
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-7 py-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th align="left">Position</Th>
                <Th align="left">Opened</Th>
                <Th align="left" onClick={() => handleSort("closeDate")} sortable>
                  Closed
                </Th>
                <Th align="right" onClick={() => handleSort("holdingDays")} sortable>
                  Held
                </Th>
                <Th align="right">Shares</Th>
                <Th align="right">Avg cost</Th>
                <Th align="right">Avg sell</Th>
                <Th align="right" onClick={() => handleSort("realizedPL")} sortable>
                  Realized P/L
                </Th>
                <Th align="right" onClick={() => handleSort("realizedPLPercent")} sortable last>
                  Return
                </Th>
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((position, idx) => (
                <tr
                  key={position.id}
                  className={cn(
                    "cursor-pointer hover:bg-fill/45",
                    idx !== displayPositions.length - 1 && "border-b border-line2"
                  )}
                  onClick={() => window.location.assign(`/research/${position.ticker}`)}
                >
                  <td className="py-[15px]">
                    <div className="font-serif text-base font-medium">{position.name}</div>
                    <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                      {position.ticker}
                    </div>
                  </td>
                  <td className="py-[15px] text-sub">
                    {new Date(position.firstBuyDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-[15px] text-sub">
                    {new Date(position.closeDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-[15px] text-right text-sub">{position.holdingDays} d</td>
                  <td className="py-[15px] text-right text-sub">
                    {formatNumber(position.totalSharesSold)}
                  </td>
                  <td className="py-[15px] text-right text-sub">
                    {formatCurrency(position.avgCostBasis, position.currency)}
                  </td>
                  <td className="py-[15px] text-right text-sub">
                    {formatCurrency(position.avgSellPrice, position.currency)}
                  </td>
                  <td
                    className={cn(
                      "py-[15px] text-right font-medium",
                      position.realizedPL >= 0 ? "text-up" : "text-dn"
                    )}
                  >
                    {position.realizedPL >= 0 && "+"}
                    {formatCurrency(position.realizedPL, position.currency)}
                  </td>
                  <td
                    className={cn(
                      "py-[15px] text-right",
                      position.realizedPLPercent >= 0 ? "text-up" : "text-dn"
                    )}
                  >
                    {position.realizedPLPercent >= 0 ? "▲" : "▼"}{" "}
                    {formatPercent(position.realizedPLPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
  last,
}: {
  label: string;
  value: React.ReactNode;
  color?: "up" | "dn";
  last?: boolean;
}) {
  return (
    <div className={cn("px-6 py-[22px]", !last && "border-r border-line2")}>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-serif text-[28px]",
          color === "up" && "text-up",
          color === "dn" && "text-dn"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  align,
  onClick,
  sortable,
  last,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  onClick?: () => void;
  sortable?: boolean;
  last?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "py-[11px] text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut",
        align === "right" ? "text-right" : "text-left",
        sortable && "cursor-pointer",
        last && "w-[85px]"
      )}
    >
      {children}
      {sortable && " ↕"}
    </th>
  );
}
