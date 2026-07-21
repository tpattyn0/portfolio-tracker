import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/ui/loading-skeleton";

/**
 * Settings route-level loading boundary (DESIGN.md "Loading skeleton
 * (route-level loading.tsx)" -> per-route composition table, "settings/loading.tsx").
 * Kicker + H1 block (no right-side page-level action — Save lives inside
 * each section). Two editorial SkeletonCards in page order (Composite score,
 * then Fundamental score), each with a header block, a single short
 * kicker-variant block approximating the live group-total/validity status
 * line (revised, plans/2026-07-21-scoring-weights-direct-percent.md — no
 * longer a 5-col SkeletonStatBand, since the real band it stood in for was
 * removed), five label+field row approximations, and a pill-shaped block for
 * the reset action.
 */
export default function SettingsLoading() {
  return (
    <div>
      <div className="mb-9 space-y-2">
        <SkeletonText variant="kicker" className="w-64" />
        <SkeletonBlock className="h-[52px] w-80 rounded" />
        <SkeletonText variant="detail" className="w-full max-w-[560px]" />
      </div>

      <div className="space-y-6">
        {[0, 1].map((section) => (
          <SkeletonCard key={section} editorial className="px-7 pb-7 pt-6">
            <div className="flex items-center justify-between border-b border-line2 pb-4">
              <SkeletonText variant="kicker" className="w-40" />
              <SkeletonText variant="kicker" className="w-56" />
            </div>

            <SkeletonText variant="kicker" className="mt-2 w-56" />

            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <SkeletonText variant="kicker" className="w-32" />
                  <SkeletonBlock className="h-10 w-full rounded-md" />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <SkeletonText variant="pill" />
              <SkeletonText variant="pill" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
