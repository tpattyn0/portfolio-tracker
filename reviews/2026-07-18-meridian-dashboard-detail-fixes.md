# Review: Meridian dashboard + detail-page fixes

Date: 2026-07-18
Status: IMPLEMENTED — 2026-07-18

## Summary

Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: MDF-S1 (optional; may be deferred to TECH_DEBT instead)

Scope: the NEW fix commits stacked onto PR #14 implementing
`plans/2026-07-18-meridian-dashboard-detail-fixes.md` — the diff from
`d7328e12` (the research-detail IMPLEMENTED stamp) to branch HEAD
(`2a5dac8d`). The prior research-detail work (`reviews/2026-07-18-meridian-research-detail.md`,
IMPLEMENTED) was NOT re-reviewed. The reviewed diff touches exactly the files
the plan declared (21 files: 8 code, 1 route + 1 route test, docs, plan, indexes).

Verdict: clean, well-scoped, faithful to the plan. `npm run verify` passes
(typecheck ok · lint ok — pre-existing warnings only · 72/72 tests ·
secret-scan: no leaks). Working tree clean, branch pushed. All five standing-
checklist items pass. Every CRITICAL requirement called out in the task was
verified in code (details below). The single SUGGESTION is a minor, pre-existing
presentational inaccuracy the hero chart faithfully inherits from the already-
reviewed `DetailPriceChart` — not a regression introduced here.

### Verified against the plan (evidence)

- **Row hover unified (Task 1).** All six call sites now use solid `hover:bg-fill`
  (`positions-table.tsx:63`, `wishlist-table.tsx:211`, `stock-search.tsx:112`,
  `news-feed.tsx:144`, `research/page.tsx:63`, `closed-positions/page.tsx:281`).
  `grep -rn "bg-fill/45\|color-mix(in_srgb,var(--fill)_45%" components app`
  returns nothing. DESIGN.md "Row hover" spec updated to `var(--fill)` full-alpha
  (`DESIGN.md:42,171`) so code and spec agree.
- **Hero chart hover + y-axis (Tasks 2/3).** `components/portfolio-chart.tsx`:
  y-axis labels via `niceYTicks(yMin,yMax,3)` from the displayed `animatedValues`;
  hover crosshair/marker/tooltip. CRITICAL checks all pass:
  - `handleMouseMove` (lines 108-115) reads only `animatedValues`/`series` state,
    never touches `rafRef` — the RAF morph is not cancelled/restarted on
    mousemove. `hoverIndex` is independent `useState` (line 54), not in the morph
    effect's deps (line 97).
  - Tooltip date reads `series[hoverIndex]?.date` (line 157) — the full series,
    not the sparse `labels` (picked ~5) array.
  - `preserveAspectRatio="none"` pixel math is container-ref based
    (`getBoundingClientRect`, lines 111-112) with percentage positioning — correct.
- **Overview error gate (Task 4).** `components/overview.tsx`: `hasError`
  all-or-nothing gate removed; composite + `SubscoreBand` render from partial
  data; a failed dimension passes `null` (→ `--mut` band via `ScoreFigure`), not a
  fabricated `5` (each `useMemo` returns `null` on `isError`, `5` only on
  resolved-but-empty). Composite weights/`?? 5` fallback/thresholds are byte-for-
  byte the prior math. No service file touched — confirmed presentational-only.
  `ScoreFigure`/`SubscoreBand` both accept `number | null | undefined` and render
  "—" for null (`score-figure.tsx:22`, `subscore-band.tsx:8`).
- **Intrinsic value 200-with-null (Task 5, ADR-12).**
  `app/api/research/[symbol]/intrinsic-value/route.ts:48-58` returns 200 with
  `intrinsicValue:null, methods:[]` ONLY for `error.message === "No fundamental
  data available"`; all other errors fall through to the 500 handler (lines
  60-64). Auth guard (401) and rate limit are unchanged and still run first. The
  new `route.test.ts` covers the sentinel→200-null path, a genuine-error→500 path,
  and the happy path (3 tests). `components/intrinsic-value.tsx` migrated to React
  Query, renders the shell with em-dash placeholders on a 200-null response, and
  keeps the full-card `AlertCircle` failure for `error || !data` (genuine
  network/parse/500). ADR-12 is well-formed (Decision/Evidence/Rationale/
  Tradeoffs/Status/Confidence).
- **Fundamental tab (Task 6).** `components/fundamental-analysis.tsx` NOT changed —
  audit-only claim is accurate. Its `error || !data` path already renders a scoped
  styled empty state (does not block other tabs; each tab is independently mounted
  and wrapped in its own `ComponentErrorBoundary`).
- **Position-detail reskin (Task 7).** `app/(dashboard)/portfolio/[ticker]/page.tsx`
  is presentational-only. CRITICAL checks all pass: the `position`/`quote`/`news`
  React Query fetches (same keys, 30s quote refetch, 5-min news staleTime),
  `deleteMutation` + `handleDelete` confirm gate, `handleRefreshNews`, every
  `ComponentErrorBoundary`, and both `SellPositionModal`/`BuyMoreModal` are intact.
  Signed figures use `text-up`/`text-dn` (lines 241/245/252/261/265) — no
  `text-green-600`/`text-red-600`. Quote card has no lucide icons and no shadows
  (only `Loader2` remains, in spinner states). TD-32 narrowed (not closed): the two
  remaining stock-shadcn areas it now cites (`SellPositionModal`/`BuyMoreModal` and
  the `TransactionHistory` body on line 331) exactly match what is still in use.
- **No hardcoded colors (ADR-8).** `git diff` of all changed `.tsx`/`.ts` for
  added `text-green-`/`text-red-`/`bg-green-`/`bg-red-`/`hsl(var(`/hex/oklch:
  none found.
- **Test-account hygiene.** No test credentials, seed scripts, or account data in
  the diff. The one occurrence of `meridian-verify-tmp@example.com` is prose inside
  the plan `.md` describing the verification method, not a credential. `scratch/`
  and `scratch/shots/` are gitignored (`git check-ignore` confirms); no
  screenshots/scratch/probe files are tracked. No test data persisted to the shared
  dev/prod DB by the diff (the DB is not touched by this change).
- **Standing checklist.** Working tree clean; STATUS.md 12 lines, links-only, no
  custom sections; TD-32/DECISIONS/ADR-12 formats conform; secret-scan clean;
  Verify block present and passing.

## Findings

### MDF-S1 — SUGGESTION
**File:** `components/portfolio-chart.tsx:159,199-207` (and identically the ported-from
original `components/research/detail-price-chart.tsx:111,119-127`)
**Problem:** The y-axis price labels are absolutely positioned at the fixed
gridline y-fractions (55/110/165 of 220), and the hover marker's vertical
position uses `hoverYFrac = 1 - (hoverValue - yMin) / valueRange`. Both ignore the
8px top/bottom `padding` that `buildPath` applies when it plots the line
(`chart-path.ts:54`: the data max plots at y≈8, the data min at y≈212, not at the
gridlines). So the label representing `yMax` is drawn ~47px above where the actual
line peak sits, and the hover dot is offset from the plotted curve by up to ~8px /
220 ≈ 3.6% of chart height. The labels and marker are internally consistent with
each other (both use the un-padded fraction), so the readout is coherent — it is
purely a small vertical registration offset against the drawn line.
**Recommendation:** Low priority and optional. If tightened, derive the label/
marker y-position from the same padded scale `buildPath` uses (add `padding` into
the fraction: `y = padding + (1 - frac) * (height - 2*padding)`), in the shared
primitive so both charts stay in lockstep. Note this is a faithful port of the
already-reviewed `DetailPriceChart` behavior (accepted in
`reviews/2026-07-18-meridian-research-detail.md`), so it is not a regression — it
may equally be logged as a TECH_DEBT row covering both charts rather than fixed
now. No user-facing data is wrong; only pixel registration.

## Proposed DECISIONS.md entries

None. ADR-12 (intrinsic route 200-with-null) was authored by the Coding agent in
this same work and is well-formed and accurate against the code; no new ADR is
needed.
