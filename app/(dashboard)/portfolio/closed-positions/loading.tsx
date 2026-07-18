import { SkeletonBlock, SkeletonStatBand, SkeletonTable, SkeletonText } from "@/components/ui/loading-skeleton";

/**
 * Closed positions route-level loading boundary (DESIGN.md "Loading
 * skeleton (route-level loading.tsx)", plan Task 7). Mirrors the 6-col
 * realized-P/L summary, ticker filter row, and All/Winning/Losing tabs.
 */
export default function ClosedPositionsLoading() {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-8">
        <div className="space-y-2">
          <SkeletonText variant="kicker" className="w-48" />
          <SkeletonBlock className="h-[52px] w-72 rounded" />
          <SkeletonText variant="detail" className="w-56" />
        </div>
        <SkeletonText variant="pill" className="h-[38px] w-32" />
      </div>

      <SkeletonStatBand columns={6} card className="mb-8" />

      <div className="mb-5 flex items-center gap-6">
        <SkeletonBlock className="h-9 w-48 rounded-[18px]" />
        <SkeletonBlock className="h-[11px] w-16" />
        <SkeletonBlock className="h-[11px] w-16" />
        <SkeletonBlock className="h-[11px] w-16" />
      </div>

      <SkeletonTable rows={6} />
    </div>
  );
}
