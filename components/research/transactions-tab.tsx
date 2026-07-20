"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { getPositionsPanelState, hasRealizedPL } from "@/lib/utils/positions-tab";

interface TransactionsTabProps {
  symbol: string;
  currency?: string;
}

interface PositionResponse {
  quantity: number;
  avgCostBasis: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  baseCurrency: string;
  realizedPL: number;
}

interface TransactionResponse {
  id: string;
  type: string;
  ticker: string;
  quantity: number;
  price: number;
  fees: number;
  totalAmount: number;
  executedAt: string;
}

async function fetchPosition(symbol: string): Promise<PositionResponse | null> {
  const res = await fetch(`/api/portfolio/positions/${symbol}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch position");
  return res.json();
}

/**
 * The Positions tab (renamed from "Transactions" per
 * plans/2026-07-19-positions-tab.md; conditional — omitted from the tab bar
 * when the symbol has no transactions on file) — reuses the existing
 * positions/[ticker] and transactions APIs; the single shared body for both
 * /research/[symbol] and /portfolio/[ticker], superseding the old
 * transaction-history.tsx table (DESIGN.md "Research detail" §6).
 */
export function TransactionsTab({ symbol, currency }: TransactionsTabProps) {
  const positionQ = useQuery({
    queryKey: ["position", symbol],
    queryFn: () => fetchPosition(symbol),
  });

  const transactionsQ = useQuery<TransactionResponse[]>({
    queryKey: ["transactions", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/transactions?ticker=${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const position = positionQ.data;
  const transactions = transactionsQ.data ?? [];

  // Three states, gated on quantity > 0 specifically — NOT merely "a position
  // record exists" (a fully-sold position still returns a 200 with
  // quantity: 0). See lib/utils/positions-tab.ts for the shared, tested rule.
  const panelState = !positionQ.isLoading ? getPositionsPanelState(position) : null;

  // Realized P/L is re-surfaced for BOTH held and closed positions (owner
  // decision PT-Q1, reviews/2026-07-19-positions-tab.md) — a settled
  // historical number, valid regardless of current quantity, unlike Market
  // value / Unrealised P/L which only make sense while shares are held.
  // Hidden when exactly zero/absent, preserving the old header's
  // `hasRealizedPL` semantic (see lib/utils/positions-tab.ts).
  const showRealizedPL = position != null && hasRealizedPL(position.realizedPL);

  return (
    <div className="space-y-5">
      {panelState === "none" && (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card px-7 py-8">
          <p className="text-sub">You do not hold {symbol}.</p>
          <Link
            href={`/portfolio/add?ticker=${symbol}`}
            className="flex h-[38px] items-center gap-1.5 rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg"
          >
            <Plus className="h-3.5 w-3.5" /> Add to portfolio
          </Link>
        </div>
      )}

      {(panelState === "closed" || panelState === "held") && (
        <div
          className="rounded-lg border border-border bg-card px-7 pb-7 pt-6"
          style={{ borderTop: "3px double var(--foreground)" }}
        >
          <div className="flex items-center justify-between border-b border-line2 pb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Position</span>
          </div>

          {panelState === "closed" && (
            <div className="space-y-1 pt-7">
              <p className="font-serif text-[14.5px] italic text-mut">Position closed.</p>
              {showRealizedPL && position && (
                <p className="text-[13px]">
                  <span className="text-mut">Realized P/L: </span>
                  <span className={cn("font-medium", position.realizedPL >= 0 ? "text-up" : "text-dn")}>
                    {formatCurrency(position.realizedPL, currency)}
                  </span>
                </p>
              )}
            </div>
          )}

          {panelState === "held" && position && (
            <div className={cn("grid pt-7", showRealizedPL ? "grid-cols-5" : "grid-cols-4")}>
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Shares held</div>
                <div className="mt-1.5 font-serif text-[26px]">{formatNumber(position.quantity, 4)}</div>
              </div>
              <div className="border-l border-line2 pl-5">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Average cost</div>
                <div className="mt-1.5 font-serif text-[26px]">{formatCurrency(position.avgCostBasis, currency)}</div>
              </div>
              <div className="border-l border-line2 pl-5">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Market value</div>
                <div className="mt-1.5 font-serif text-[26px]">{formatCurrency(position.marketValue, currency)}</div>
              </div>
              <div className="border-l border-line2 pl-5">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Unrealised P/L</div>
                <div className={cn("mt-1.5 font-serif text-[26px]", position.unrealizedPL >= 0 ? "text-up" : "text-dn")}>
                  {formatCurrency(position.unrealizedPL, currency)}
                </div>
                <div className={cn("mt-0.5 text-[12px]", position.unrealizedPL >= 0 ? "text-up" : "text-dn")}>
                  {formatPercent(position.unrealizedPLPercent)}
                </div>
              </div>
              {showRealizedPL && (
                <div className="border-l border-line2 pl-5">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Realized P/L</div>
                  <div className={cn("mt-1.5 font-serif text-[26px]", position.realizedPL >= 0 ? "text-up" : "text-dn")}>
                    {formatCurrency(position.realizedPL, currency)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card px-7 pb-7 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Your transactions</div>
          <Link
            href={`/portfolio/add?ticker=${symbol}`}
            className="flex h-8 items-center rounded-full border border-line px-4 text-[12.5px] font-medium text-foreground"
          >
            + Add transaction
          </Link>
        </div>

        {transactionsQ.isLoading ? (
          <div className="flex h-24 items-center justify-center text-mut">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <p className="mt-5 font-serif text-[14.5px] italic text-mut">No transactions on file for {symbol}.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="pb-2.5 text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Date</th>
                <th className="pb-2.5 text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Type</th>
                <th className="pb-2.5 text-right text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Shares</th>
                <th className="pb-2.5 text-right text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Price</th>
                <th className="pb-2.5 text-right text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Fees</th>
                <th className="pb-2.5 text-right text-[10.5px] font-normal uppercase tracking-[0.12em] text-mut">Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={tx.id} className={cn(i < transactions.length - 1 && "border-b border-line2")}>
                  <td className="py-[15px]">{format(new Date(tx.executedAt), "MMM d, yyyy")}</td>
                  <td className="py-[15px]">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="py-[15px] text-right">{formatNumber(tx.quantity)}</td>
                  <td className="py-[15px] text-right">{formatCurrency(tx.price, currency)}</td>
                  <td className="py-[15px] text-right">{formatCurrency(tx.fees, currency)}</td>
                  <td className="py-[15px] text-right font-medium">{formatCurrency(tx.totalAmount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * DESIGN.md "Outlined type badge": BUY = 1px --up border / --up text;
 * everything else (SELL, or any type the schema doesn't model — see
 * TECH_DEBT.md TD-DTL-TXTYPE) = 1px --line border / --mut text.
 */
function TypeBadge({ type }: { type: string }) {
  const isBuy = type === "BUY";
  return (
    <span
      className={cn(
        "inline-block rounded-[10px] border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
        isBuy ? "border-up text-up" : "border-line text-mut"
      )}
    >
      {type}
    </span>
  );
}
