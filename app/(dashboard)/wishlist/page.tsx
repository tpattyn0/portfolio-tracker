"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Plus, TrendingUp } from "lucide-react";
import { AddToWishlistModal } from "@/components/add-to-wishlist-modal";
import { WishlistTable } from "@/components/wishlist-table";
import { WishlistItemWithScores } from "@/lib/services/wishlist.service";

export default function WishlistPage() {
  const { data: wishlistItems, isLoading } = useQuery<WishlistItemWithScores[]>({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await fetch("/api/wishlist");
      if (!res.ok) throw new Error("Failed to fetch wishlist");
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return <WishlistSkeleton />;
  }

  const hasItems = wishlistItems && wishlistItems.length > 0;

  // Calculate stats
  const stats = hasItems
    ? {
        total: wishlistItems.length,
        targetReached: wishlistItems.filter(
          (item) =>
            item.targetPrice !== null && item.currentPrice <= item.targetPrice
        ).length,
        avgScore:
          wishlistItems
            .filter((item) => item.compositeScore !== null)
            .reduce((sum, item) => sum + (item.compositeScore || 0), 0) /
            wishlistItems.filter((item) => item.compositeScore !== null)
              .length || 0,
      }
    : { total: 0, targetReached: 0, avgScore: 0 };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wishlist</h1>
          <p className="text-gray-600 mt-1">
            Track stocks you're interested in before investing
          </p>
        </div>
        <AddToWishlistModal />
      </div>

      {/* Stats Cards */}
      {hasItems && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Stocks Watching
              </CardTitle>
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                of 50 max
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Targets Reached
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.targetReached}</div>
              <p className="text-xs text-muted-foreground">
                Time to consider buying
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Score
              </CardTitle>
              <Star className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgScore > 0 ? stats.avgScore.toFixed(1) : "N/A"}/10
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wishlist Items */}
      {hasItems ? (
        <WishlistTable items={wishlistItems} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-400 mb-4">
              <Star className="h-16 w-16" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Your wishlist is empty
            </h3>
            <p className="text-gray-600 mb-6 text-center max-w-md">
              Start tracking stocks you're interested in. Monitor their
              performance, scores, and get notified when they hit your target
              price.
            </p>
            <AddToWishlistModal
              trigger={
                <Button size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Stock
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <Skeleton className="h-6 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
