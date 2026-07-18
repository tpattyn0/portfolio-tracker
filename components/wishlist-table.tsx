"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import { WishlistItemWithScores } from "@/lib/services/wishlist.service";

interface WishlistTableProps {
  items: WishlistItemWithScores[];
}

type SortKey =
  | "ticker"
  | "currentPrice"
  | "priceChangePercent"
  | "compositeScore"
  | "fundamentalScore"
  | "analystScore"
  | "technicalScore"
  | "sentimentScore"
  | "intrinsicScore"
  | "targetPriceUpside";

type SortDirection = "asc" | "desc" | null;

/**
 * Meridian presentational score bands (DESIGN.md "Score figure"). Recolors an
 * already-computed number — no scoring logic changes. Thresholds differ from
 * the pre-reskin bands (>=7/>=5/<5): Meridian specifies >=7 / 4-7 / <4.
 */
function getScoreColor(score: number | null): string {
  if (score === null) return "text-mut";
  if (score >= 7) return "text-up";
  if (score >= 4) return "text-amber";
  return "text-dn";
}

export function WishlistTable({ items }: WishlistTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [deleteItem, setDeleteItem] = useState<WishlistItemWithScores | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove from wishlist");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({
        title: "Removed from watchlist",
        description: `${deleteItem?.ticker} has been removed from your watchlist`,
      });
      setDeleteItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return items;

    return [...items].sort((a, b) => {
      let aValue = a[sortKey];
      let bValue = b[sortKey];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (sortKey === "compositeScore") {
        if (a.compositeScore === null) {
          const scores = [
            a.fundamentalScore,
            a.analystScore,
            a.technicalScore,
            a.sentimentScore,
            a.intrinsicScore,
          ].filter((s) => s !== null) as number[];
          aValue = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
        }
        if (b.compositeScore === null) {
          const scores = [
            b.fundamentalScore,
            b.analystScore,
            b.technicalScore,
            b.sentimentScore,
            b.intrinsicScore,
          ].filter((s) => s !== null) as number[];
          bValue = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
        }
      }

      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, sortKey, sortDirection]);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card px-7 py-3">
        <table className="w-full border-collapse text-[13.5px]" style={{ minWidth: 1180 }}>
          <thead>
            <tr className="border-b border-border">
              <Th onClick={() => handleSort("ticker")} sortKey="ticker" active={sortKey} dir={sortDirection}>
                Stock
              </Th>
              <Th indent>Added</Th>
              <Th indent>Target</Th>
              <Th align="right" indent onClick={() => handleSort("currentPrice")} sortKey="currentPrice" active={sortKey} dir={sortDirection}>
                Price
              </Th>
              <Th align="right" indent onClick={() => handleSort("priceChangePercent")} sortKey="priceChangePercent" active={sortKey} dir={sortDirection}>
                Change
              </Th>
              <Th align="right" indent onClick={() => handleSort("fundamentalScore")} sortKey="fundamentalScore" active={sortKey} dir={sortDirection}>
                Fund.
              </Th>
              <Th align="right" indent onClick={() => handleSort("technicalScore")} sortKey="technicalScore" active={sortKey} dir={sortDirection}>
                Tech.
              </Th>
              <Th align="right" indent onClick={() => handleSort("intrinsicScore")} sortKey="intrinsicScore" active={sortKey} dir={sortDirection}>
                Intrinsic
              </Th>
              <Th align="right" indent onClick={() => handleSort("analystScore")} sortKey="analystScore" active={sortKey} dir={sortDirection}>
                Analysts
              </Th>
              <Th align="right" indent onClick={() => handleSort("sentimentScore")} sortKey="sentimentScore" active={sortKey} dir={sortDirection}>
                Sent.
              </Th>
              <Th align="right" indent emphasize onClick={() => handleSort("compositeScore")} sortKey="compositeScore" active={sortKey} dir={sortDirection}>
                Score
              </Th>
              <Th align="right" indent onClick={() => handleSort("targetPriceUpside")} sortKey="targetPriceUpside" active={sortKey} dir={sortDirection}>
                Upside
              </Th>
              <th className="w-[88px] py-[11px] text-right text-[10.5px] font-normal uppercase tracking-[0.1em] text-mut" />
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, idx) => {
              const priceChangePositive = item.priceChangePercent >= 0;
              const hasTargetPrice = item.targetPrice !== null;
              const targetPriceReached = hasTargetPrice && item.currentPrice <= item.targetPrice!;

              const overallScore =
                item.compositeScore !== null
                  ? item.compositeScore
                  : (() => {
                      const scores = [
                        item.fundamentalScore,
                        item.analystScore,
                        item.technicalScore,
                        item.sentimentScore,
                        item.intrinsicScore,
                      ].filter((score) => score !== null) as number[];
                      return scores.length > 0
                        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
                        : null;
                    })();

              return (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/research/${item.ticker}`)}
                  className={cn(
                    "cursor-pointer hover:bg-fill",
                    idx !== sortedItems.length - 1 && "border-b border-line2"
                  )}
                >
                  <td className="whitespace-nowrap py-[15px]">
                    <div className="font-serif text-base font-medium">
                      {item.name}
                      {targetPriceReached && (
                        <span className="ml-2 inline-flex items-center rounded-[10px] border border-up px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-up">
                          Target reached
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                      {item.ticker}
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-[15px] pl-4 text-sub">
                    {new Date(item.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap py-[15px] pl-4",
                      targetPriceReached ? "font-medium text-up" : "text-sub"
                    )}
                  >
                    {hasTargetPrice
                      ? `Price ≤ ${formatCurrency(item.targetPrice!, item.currency)}`
                      : "—"}
                  </td>
                  <td className="py-[15px] pl-4 text-right font-medium">
                    {formatCurrency(item.currentPrice, item.currency)}
                  </td>
                  <td className={cn("py-[15px] pl-4 text-right", priceChangePositive ? "text-up" : "text-dn")}>
                    {formatPercent(item.priceChangePercent)}
                  </td>
                  <ScoreCell value={item.fundamentalScore} />
                  <ScoreCell value={item.technicalScore} />
                  <ScoreCell value={item.intrinsicScore} />
                  <ScoreCell value={item.analystScore} />
                  <ScoreCell value={item.sentimentScore} />
                  <td className={cn("py-[15px] pl-4 text-right font-serif text-[19px] font-medium", getScoreColor(overallScore))}>
                    {overallScore !== null ? overallScore.toFixed(1) : "—"}
                  </td>
                  <td
                    className={cn(
                      "py-[15px] pl-4 text-right",
                      item.targetPriceUpside !== null
                        ? item.targetPriceUpside >= 0
                          ? "text-up"
                          : "text-dn"
                        : "text-mut"
                    )}
                  >
                    {item.targetPriceUpside !== null ? formatPercent(item.targetPriceUpside) : "—"}
                  </td>
                  <td className="whitespace-nowrap py-[15px] text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionButton
                      title="Add to portfolio"
                      href={`/portfolio/add?ticker=${item.ticker}`}
                      variant="add"
                    />
                    <RowActionButton
                      title="Remove"
                      variant="remove"
                      onClick={() => setDeleteItem(item)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteItem !== null} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from watchlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteItem?.ticker} from your watchlist?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteItem(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  return (
    <td className={cn("py-[15px] pl-4 text-right", getScoreColor(value))}>
      {value !== null ? value.toFixed(1) : "—"}
    </td>
  );
}

function Th({
  children,
  align = "left",
  indent,
  emphasize,
  onClick,
  sortKey,
  active,
  dir,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  indent?: boolean;
  emphasize?: boolean;
  onClick?: () => void;
  sortKey?: SortKey;
  active?: SortKey | null;
  dir?: SortDirection;
}) {
  const isActive = sortKey && active === sortKey;
  return (
    <th
      onClick={onClick}
      className={cn(
        "whitespace-nowrap py-[11px] text-[10.5px] uppercase tracking-[0.1em]",
        align === "right" ? "text-right" : "text-left",
        indent && "pl-4",
        onClick && "cursor-pointer",
        emphasize ? "font-semibold text-foreground" : "font-normal text-mut"
      )}
    >
      {children}
      {onClick && (isActive ? (dir === "asc" ? " ↑" : " ↓") : sortKey === "ticker" || emphasize ? " ↕" : "")}
    </th>
  );
}

function RowActionButton({
  title,
  href,
  variant,
  onClick,
}: {
  title: string;
  href?: string;
  variant: "add" | "remove";
  onClick?: () => void;
}) {
  const className = cn(
    "ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border align-middle text-sub",
    variant === "add" && "hover:border-foreground hover:text-foreground",
    variant === "remove" && "hover:border-dn hover:text-dn"
  );

  const icon =
    variant === "add" ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" title={title} onClick={onClick} className={className}>
      {icon}
    </button>
  );
}
