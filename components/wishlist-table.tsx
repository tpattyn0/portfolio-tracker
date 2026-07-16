"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  ShoppingCart,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import { WishlistItemWithScores } from "@/lib/services/wishlist.service";
import Link from "next/link";

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

export function WishlistTable({ items }: WishlistTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [deleteItem, setDeleteItem] = useState<WishlistItemWithScores | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wishlist/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove from wishlist");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({
        title: "Removed from Wishlist",
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

      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // For composite score, calculate it if not available
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

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 7) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  return (
    <>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[200px]"
                onClick={() => handleSort("ticker")}
              >
                <div className="flex items-center">
                  Stock
                  <SortIcon columnKey="ticker" />
                </div>
              </TableHead>
              <TableHead className="w-[110px]">
                Added
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("currentPrice")}
              >
                <div className="flex items-center">
                  Price
                  <SortIcon columnKey="currentPrice" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[100px]"
                onClick={() => handleSort("priceChangePercent")}
              >
                <div className="flex items-center">
                  Change
                  <SortIcon columnKey="priceChangePercent" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("compositeScore")}
              >
                <div className="flex items-center">
                  Score
                  <SortIcon columnKey="compositeScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("fundamentalScore")}
              >
                <div className="flex items-center">
                  Fundamental
                  <SortIcon columnKey="fundamentalScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("technicalScore")}
              >
                <div className="flex items-center">
                  Technical
                  <SortIcon columnKey="technicalScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("intrinsicScore")}
              >
                <div className="flex items-center">
                  Intrinsic
                  <SortIcon columnKey="intrinsicScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("sentimentScore")}
              >
                <div className="flex items-center">
                  Sentiment
                  <SortIcon columnKey="sentimentScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("analystScore")}
              >
                <div className="flex items-center">
                  Analysts
                  <SortIcon columnKey="analystScore" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[110px]"
                onClick={() => handleSort("targetPriceUpside")}
              >
                <div className="flex items-center">
                  Upside
                  <SortIcon columnKey="targetPriceUpside" />
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => {
              const priceChangePositive = item.priceChangePercent >= 0;
              const hasTargetPrice = item.targetPrice !== null;
              const targetPriceReached =
                hasTargetPrice && item.currentPrice <= item.targetPrice!;

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
                        ? scores.reduce((sum, score) => sum + score, 0) /
                            scores.length
                        : null;
                    })();

              return (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{item.ticker}</span>
                          {targetPriceReached && (
                            <Badge className="bg-green-600 text-xs h-5">Target!</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {formatCurrency(item.currentPrice, item.currency)}
                    </div>
                    {hasTargetPrice && (
                      <div className="text-xs text-blue-600">
                        Target: {formatCurrency(item.targetPrice!, item.currency)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        priceChangePositive
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {formatPercent(item.priceChangePercent)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {overallScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(overallScore)
                        )}
                      >
                        {overallScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.fundamentalScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(item.fundamentalScore)
                        )}
                      >
                        {item.fundamentalScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.technicalScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(item.technicalScore)
                        )}
                      >
                        {item.technicalScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.intrinsicScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(item.intrinsicScore)
                        )}
                      >
                        {item.intrinsicScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.sentimentScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(item.sentimentScore)
                        )}
                      >
                        {item.sentimentScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.analystScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          getScoreColor(item.analystScore)
                        )}
                      >
                        {item.analystScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.targetPriceUpside !== null ? (
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          item.targetPriceUpside >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {formatPercent(item.targetPriceUpside)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/research/${item.ticker}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Link href={`/portfolio/add?ticker=${item.ticker}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <ShoppingCart className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteItem !== null} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Wishlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteItem?.ticker} from your wishlist?
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
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
