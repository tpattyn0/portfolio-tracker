"use client";

import { useRouter } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface Position {
  id: string;
  ticker: string;
  name: string;
  exchange?: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  originalCurrency?: string;
  currency?: string;
}

interface PositionsTableProps {
  positions: Position[];
  baseCurrency?: string;
}

export function PositionsTable({ positions, baseCurrency = "EUR" }: PositionsTableProps) {
  const router = useRouter();

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-[11px] text-left text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Position
          </th>
          <th className="py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Shares
          </th>
          <th className="py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Avg cost
          </th>
          <th className="py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Price
          </th>
          <th className="py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Market value
          </th>
          <th className="py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            P/L
          </th>
          <th className="w-[90px] py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut">
            Return
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position, idx) => (
          <tr
            key={position.id}
            onClick={() => router.push(`/portfolio/${position.ticker}`)}
            className={cn(
              "cursor-pointer hover:bg-fill/45",
              idx !== positions.length - 1 && "border-b border-line2"
            )}
          >
            <td className="py-[15px]">
              <div className="font-serif text-base font-medium">{position.name}</div>
              <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                {position.ticker}
                {position.exchange ? ` · ${position.exchange}` : ""}
              </div>
            </td>
            <td className="py-[15px] text-right text-sub">
              {formatNumber(position.quantity, position.quantity % 1 === 0 ? 0 : 2)}
            </td>
            <td className="py-[15px] text-right text-sub">
              {formatCurrency(position.avgCostBasis, position.currency)}
            </td>
            <td className="py-[15px] text-right text-sub">
              {formatCurrency(position.currentPrice, position.currency)}
            </td>
            <td className="py-[15px] text-right font-medium">
              {formatCurrency(position.marketValue, position.currency)}
            </td>
            <td
              className={cn(
                "py-[15px] text-right",
                position.unrealizedPL >= 0 ? "text-up" : "text-dn"
              )}
            >
              {position.unrealizedPL >= 0 && "+"}
              {formatCurrency(
                position.unrealizedPL,
                position.originalCurrency || position.currency || baseCurrency
              )}
            </td>
            <td
              className={cn(
                "py-[15px] text-right",
                position.unrealizedPLPercent >= 0 ? "text-up" : "text-dn"
              )}
            >
              {formatPercent(position.unrealizedPLPercent)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
