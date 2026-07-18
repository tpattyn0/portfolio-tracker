import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/ui/loading-skeleton";

/**
 * Research index route-level loading boundary (DESIGN.md "Loading skeleton
 * (route-level loading.tsx)", plan Task 7). This route's popular-stocks
 * list is static, but it still gets a loading.tsx per the plan's blanket
 * Task 7 scope.
 */
export default function ResearchLoading() {
  return (
    <div>
      <div className="mx-auto max-w-[720px] pt-9 text-center">
        <SkeletonText variant="kicker" className="mx-auto w-40" />
        <SkeletonBlock className="mx-auto mt-2.5 h-[52px] w-96 rounded" />
        <SkeletonBlock className="mx-auto mb-7 mt-3 h-4 w-[420px] rounded" />
        <SkeletonBlock className="mx-auto h-[34px] w-[200px] rounded-[17px]" />
      </div>

      <SkeletonCard className="mt-14">
        <div className="grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line2 px-3 py-4">
              <div className="space-y-1.5">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonText variant="kicker" className="w-16" />
              </div>
              <SkeletonBlock className="h-4 w-14" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
