import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonStatBand,
  SkeletonTabBar,
} from "@/components/ui/loading-skeleton";

/**
 * Position detail route-level loading boundary (DESIGN.md "Loading
 * skeleton (route-level loading.tsx)", plan Task 7). Per TD-32 / DESIGN.md
 * "Position detail" this page reuses the Research detail screen's chrome
 * (header + quote-card + tab-bar), so its skeleton reuses the same
 * composition as research/[symbol]/loading.tsx — the geometry is
 * identical (4 equal columns, card-wrapped, border-line2 verticals);
 * skeletons never render real cell labels so the different metric set
 * (Market value / Unrealized P/L / Realized P/L / Today's change) is a
 * non-issue.
 */
export default function PositionDetailLoading() {
  return (
    <div>
      <div className="my-[18px] mb-8 flex items-end justify-between">
        <div>
          <SkeletonBlock className="h-[52px] w-72 rounded" />
          <SkeletonBlock className="mt-2 h-[11px] w-24 rounded" />
        </div>
        <div className="flex gap-3">
          <SkeletonBlock className="h-[38px] w-28 rounded-full" />
          <SkeletonBlock className="h-[38px] w-28 rounded-full" />
          <SkeletonBlock className="h-[38px] w-28 rounded-full" />
        </div>
      </div>

      <SkeletonStatBand columns={4} card className="mb-5" />

      <SkeletonTabBar className="mb-5" />

      <SkeletonCard editorial>
        <div className="grid grid-cols-[280px_1fr] gap-14">
          <div className="space-y-3">
            <SkeletonBlock className="h-[84px] w-32 rounded" />
            <SkeletonBlock className="h-[11px] w-28 rounded" />
          </div>
          <SkeletonBlock className="h-40 w-full" />
        </div>
      </SkeletonCard>
    </div>
  );
}
