import { SkeletonBlock, SkeletonCard, SkeletonStatBand, SkeletonTable, SkeletonText } from "@/components/ui/loading-skeleton";

/**
 * Dashboard route-level loading boundary (DESIGN.md "Loading skeleton
 * (route-level loading.tsx)", plan Task 7). Replaces the stale
 * stock-shadcn skeleton that predated the Meridian re-skin — matches the
 * shipped layout: hero figure, 3-col ruled stat band, chart card, positions
 * table.
 */
export default function DashboardLoading() {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-12 pb-9">
        <div>
          <SkeletonText variant="kicker" className="w-32" />
          <SkeletonBlock className="mt-2.5 h-[54px] w-72 rounded" />
        </div>
        <SkeletonText variant="pill" className="h-10 w-40" />
      </div>

      <SkeletonStatBand columns={3} className="mb-11" />

      <SkeletonCard className="mb-5 h-[300px]" />

      <SkeletonCard>
        <SkeletonTable rows={5} />
      </SkeletonCard>
    </div>
  );
}
