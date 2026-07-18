import { SkeletonBlock, SkeletonStatBand, SkeletonTable, SkeletonText } from "@/components/ui/loading-skeleton";

/**
 * Watchlist route-level loading boundary (DESIGN.md "Loading skeleton
 * (route-level loading.tsx)", plan Task 7). Replaces the inline
 * WishlistSkeleton (same shape, now shared).
 */
export default function WishlistLoading() {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-10">
        <div>
          <SkeletonText variant="kicker" className="w-56" />
          <SkeletonBlock className="mt-2.5 h-[52px] w-64 rounded" />
        </div>
        <SkeletonText variant="pill" className="h-[38px] w-44" />
      </div>

      <SkeletonStatBand columns={3} className="mb-8" />

      <SkeletonTable rows={5} />
    </div>
  );
}
