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
 * removed), then a single compact trigger-row block (revised per
 * plans/2026-07-21-scoring-picker-collapsible-ux.md, ADR-25 — supersedes the
 * 3-representative-row expanded-list skeleton the descriptions-retune plan
 * originally specified here: the real disclosure is closed by default, so
 * its skeleton must also render as a closed disclosure, not a preview of its
 * open contents) approximating the collapsed "Start from a style" trigger —
 * one kicker-variant block plus a small square chevron-footprint block, no
 * bordered option list beneath it — then five label+field row
 * approximations, and a pill-shaped block for the reset action.
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

            <div className="mb-5 mt-5 flex items-center justify-between gap-2 py-1">
              <SkeletonText variant="kicker" className="w-56" />
              <SkeletonBlock className="h-4 w-4 shrink-0" />
            </div>

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
