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
 * removed), then another short kicker-variant block (the preset picker's
 * label) followed by a small bordered stack of 3 label-line/description-line
 * row pairs (revised per plans/2026-07-21-scoring-style-descriptions-retune.md
 * — supersedes the wrapped-pill-row skeleton the presets plan originally
 * specified here — mirroring the real hairline-divided list container: a
 * representative sample of 3 rows, not the real per-section count of 9/6),
 * then five label+field row approximations, and a pill-shaped block for
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

            <div className="mb-5 mt-5">
              <SkeletonText variant="kicker" className="mb-2 w-32" />
              <div className="rounded-md border border-line divide-y divide-line2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex flex-col gap-1 px-4 py-3">
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
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
