import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonStatBand,
  SkeletonTabBar,
  SkeletonText,
} from "@/components/ui/loading-skeleton";

/**
 * Research detail route-level loading boundary (DESIGN.md "Loading
 * skeleton (route-level loading.tsx)", plan Task 7). Mirrors the company
 * header, 4-col quote-stat card, 7-tab bar, and the Overview tab's
 * Headline score card shape (always rendered, since Overview is the
 * default active tab).
 */
export default function ResearchDetailLoading() {
  return (
    <div>
      <SkeletonText variant="kicker" className="w-40" />

      <div className="my-[18px] mb-8 flex items-end justify-between">
        <div>
          <SkeletonBlock className="h-[52px] w-72 rounded" />
          <SkeletonText variant="kicker" className="mt-2 w-24" />
        </div>
        <div className="flex gap-3">
          <SkeletonText variant="pill" className="h-[38px] w-28" />
          <SkeletonText variant="pill" className="h-[38px] w-40" />
        </div>
      </div>

      <SkeletonStatBand columns={4} card className="mb-5" />

      <SkeletonTabBar className="mb-5" />

      <SkeletonCard editorial>
        <div className="grid grid-cols-[280px_1fr] gap-14">
          <div className="space-y-3">
            <SkeletonBlock className="h-[84px] w-32 rounded" />
            <SkeletonText variant="kicker" className="w-28" />
          </div>
          <SkeletonBlock className="h-40 w-full" />
        </div>
      </SkeletonCard>
    </div>
  );
}
