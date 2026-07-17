"use client";

import { useQuery } from "@tanstack/react-query";
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

  const stats = hasItems
    ? {
        total: wishlistItems.length,
        targetReached: wishlistItems.filter(
          (item) => item.targetPrice !== null && item.currentPrice <= item.targetPrice
        ).length,
        avgScore:
          wishlistItems
            .filter((item) => item.compositeScore !== null)
            .reduce((sum, item) => sum + (item.compositeScore || 0), 0) /
            wishlistItems.filter((item) => item.compositeScore !== null).length || 0,
      }
    : { total: 0, targetReached: 0, avgScore: 0 };

  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-mut">
            Under observation · before you invest
          </div>
          <h1 className="mt-2.5 font-serif text-[52px] font-medium leading-[1.05]">
            Watchlist
          </h1>
        </div>
        <AddToWishlistModal
          trigger={
            <button
              type="button"
              className="h-[38px] rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg"
            >
              + Add to watchlist
            </button>
          }
        />
      </div>

      {/* Ruled stat band */}
      {hasItems && (
        <div className="mb-8 grid grid-cols-3 border-y border-border">
          <div className="py-[18px] pb-5 pr-12">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Targets reached
            </div>
            <div className="mt-2 font-serif text-[26px] font-medium text-up">
              {stats.targetReached}
            </div>
            <div className="mt-[3px] text-xs text-up">
              {stats.targetReached > 0 ? "Time to consider buying" : "None yet"}
            </div>
          </div>
          <div className="border-l border-line2 px-12 py-[18px] pb-5">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Watched</div>
            <div className="mt-2 font-serif text-[26px] font-medium">
              {stats.total}
              <span className="text-[15px] text-mut"> of 50</span>
            </div>
            <div className="mt-[3px] text-xs text-mut">
              {50 - stats.total} slot{50 - stats.total === 1 ? "" : "s"} remaining
            </div>
          </div>
          <div className="border-l border-line2 py-[18px] pb-5 pl-12">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Average score
            </div>
            <div className="mt-2 font-serif text-[26px] font-medium">
              {stats.avgScore > 0 ? stats.avgScore.toFixed(1) : "—"}
              <span className="text-[15px] text-mut"> / 10</span>
            </div>
            <div className="mt-[3px] text-xs text-mut">Across all watched stocks</div>
          </div>
        </div>
      )}

      {/* Table */}
      {hasItems ? (
        <WishlistTable items={wishlistItems} />
      ) : (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <h3 className="mb-2 font-serif text-lg font-medium">Your watchlist is empty</h3>
          <p className="mx-auto mb-6 max-w-md text-sub">
            Start tracking stocks you&rsquo;re interested in. Monitor their
            performance, scores, and get notified when they hit your target price.
          </p>
          <AddToWishlistModal
            trigger={
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-full bg-btnbg px-6 text-[13px] font-medium text-btnfg"
              >
                + Add your first stock
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-10">
        <div>
          <div className="h-3 w-56 rounded bg-fill" />
          <div className="mt-3 h-12 w-64 rounded bg-fill" />
        </div>
        <div className="h-10 w-40 rounded-full bg-fill" />
      </div>
      <div className="grid grid-cols-3 gap-8 border-y border-border py-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-fill" />
            <div className="h-7 w-16 rounded bg-fill" />
            <div className="h-3 w-32 rounded bg-fill" />
          </div>
        ))}
      </div>
      <div className="h-96 w-full rounded-lg border border-border bg-fill" />
    </div>
  );
}
