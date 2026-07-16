"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  ShoppingCart,
  BarChart3,
  Users,
  Loader2,
  LineChart,
  Calculator,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import { WishlistItemWithScores } from "@/lib/services/wishlist.service";
import Link from "next/link";

interface WishlistItemCardProps {
  item: WishlistItemWithScores;
}

export function WishlistItemCard({ item }: WishlistItemCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wishlist/${item.id}`, {
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
        description: `${item.ticker} has been removed from your watchlist`,
      });
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const priceChangePositive = item.priceChangePercent >= 0;
  const hasTargetPrice = item.targetPrice !== null;
  const targetPriceReached = hasTargetPrice && item.currentPrice <= item.targetPrice!;

  // Use composite score if available, otherwise calculate average
  const overallScore = item.compositeScore !== null
    ? item.compositeScore
    : (() => {
        const scores = [
          item.fundamentalScore,
          item.analystScore,
          item.technicalScore,
          item.sentimentScore,
          item.intrinsicScore
        ].filter((score) => score !== null) as number[];
        return scores.length > 0
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : null;
      })();

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 7) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return "N/A";
    if (score >= 7) return "Strong Buy";
    if (score >= 5) return "Hold";
    return "Weak";
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{item.ticker}</h3>
                {targetPriceReached && (
                  <Badge className="bg-green-600 text-xs">Target Reached!</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                Added {new Date(item.createdAt).toLocaleDateString()} at {formatCurrency(item.addedPrice)}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/portfolio/add?ticker=${item.ticker}`}>
                <Button variant="outline" size="sm" className="h-8">
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Add to Portfolio
                </Button>
              </Link>
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remove from Wishlist</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to remove {item.ticker} from your wishlist?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteDialog(false)}
                      disabled={deleteMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
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
            </div>
          </div>

          {/* Price & Score Row */}
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-center">
            {/* Price Info */}
            <div className="space-y-1">
              <div>
                <p className="text-xs text-muted-foreground">Current Price</p>
                <p className="text-2xl font-bold">{formatCurrency(item.currentPrice)}</p>
              </div>
              <div className="flex items-center gap-1">
                {priceChangePositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    priceChangePositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {priceChangePositive && "+"}{formatPercent(item.priceChangePercent)}
                </span>
                <span className="text-xs text-muted-foreground">since added</span>
              </div>
            </div>

            {/* Investment Score */}
            {overallScore !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Investment Score</span>
                  <span className={cn("text-lg font-bold", getScoreColor(overallScore))}>
                    {overallScore.toFixed(1)}/10
                  </span>
                </div>
                <Progress value={overallScore * 10} className="h-2" />
                <p className={cn("text-xs font-medium", getScoreColor(overallScore))}>
                  {getScoreLabel(overallScore)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-1">
              {hasTargetPrice && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Your Target</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatCurrency(item.targetPrice!)}
                  </p>
                </div>
              )}
              <Link href={`/research/${item.ticker}`}>
                <Button variant="default" size="sm" className="w-full h-8">
                  View Details
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Individual Scores - Horizontal Grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t">
            {item.fundamentalScore !== null && (
              <div className="flex flex-col items-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                <BarChart3 className="h-4 w-4 text-blue-600 mb-0.5" />
                <p className="text-xs text-muted-foreground">Fundamentals</p>
                <p className={cn("text-sm font-bold", getScoreColor(item.fundamentalScore))}>
                  {item.fundamentalScore.toFixed(1)}
                </p>
              </div>
            )}

            {item.analystScore !== null && (
              <div className="flex flex-col items-center p-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
                <Users className="h-4 w-4 text-purple-600 mb-0.5" />
                <p className="text-xs text-muted-foreground">Analyst</p>
                <p className={cn("text-sm font-bold", getScoreColor(item.analystScore))}>
                  {item.analystScore.toFixed(1)}
                </p>
              </div>
            )}

            {item.sentimentScore !== null && (
              <div className="flex flex-col items-center p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
                <MessageSquare className="h-4 w-4 text-indigo-600 mb-0.5" />
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <p className={cn("text-sm font-bold", getScoreColor(item.sentimentScore))}>
                  {item.sentimentScore.toFixed(1)}
                </p>
              </div>
            )}

            {item.intrinsicScore !== null && (
              <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                <Calculator className="h-4 w-4 text-emerald-600 mb-0.5" />
                <p className="text-xs text-muted-foreground">Intrinsic</p>
                <p className={cn("text-sm font-bold", getScoreColor(item.intrinsicScore))}>
                  {item.intrinsicScore.toFixed(1)}
                </p>
              </div>
            )}

            {item.targetPriceUpside !== null && (
              <div className="flex flex-col items-center p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors">
                <TrendingUp className="h-4 w-4 text-orange-600 mb-0.5" />
                <p className="text-xs text-muted-foreground">Upside</p>
                <p className={cn("text-sm font-bold", item.targetPriceUpside >= 0 ? "text-green-600" : "text-red-600")}>
                  {formatPercent(item.targetPriceUpside)}
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-xs font-medium text-yellow-900 mb-0.5">Notes</p>
              <p className="text-xs text-yellow-800">{item.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
