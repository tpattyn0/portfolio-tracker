# Plan: small visual fixes (research + dashboard)
Date: 2026-07-20

## Problem

Four owner-reported visual issues (two screenshots), on the same open PR #19 /
branch `fix/research-tab-fixes`. Root-caused individually below; each is labelled
by kind so the owner knows what is a one-line CSS change vs. what needed real
diagnosis.

1. **[trivial CSS]** A horizontal divider line sits ABOVE the scenario/breakdown
   column band on two tabs — the BEAR/BASE/BULL band (Intrinsic value) and the
   POSITIVE/NEUTRAL/NEGATIVE band (News & sentiment). Owner wants both lines gone.
2. **[behavioral-rendering]** On page open, structure paints with empty/placeholder
   values before the real text/data fills in (flash of empty structure).
3. **[behavioral-rendering]** A score renders one number, then quickly changes to
   another (score flicker on open).
4. **[chart-data-logic — real bug]** The dashboard Performance graph goes above the
   top gridline and below the bottom one — the plotted line falls outside the
   labelled axis range.

## Root causes (verified against code)

### Issue 1 — the divider is `border-t` on the band's grid wrapper
- **Intrinsic:** `components/intrinsic-value.tsx:113` —
  `<div className="grid grid-cols-3 border-t border-line pt-5">` wraps the
  Bear/Base/Bull columns.
- **News:** `components/news-feed.tsx:116` —
  `<div className="grid grid-cols-3 border-t border-line pt-5">` wraps the
  Positive/Neutral/Negative `ToneCell`s.
- **Finding:** `border-line` is a **dead / no-op class** — there is no `--line`
  CSS variable (`app/globals.css` defines `--line2` and `--border`, never `--line`)
  and no `line` entry in `tailwind.config.js`'s color map, so Tailwind emits no
  `border-color` for it. The visible rule comes entirely from **`border-t`** using
  the default border color. Removing `border-t border-line` (keeping `pt-5` for
  spacing) removes the line cleanly. Confirmed the element directly above each band
  is the same Headline score card body (the left score column / summary sit in the
  sibling grid column, not above this band), so removing this top border does **not**
  erase an intentional divider separating a different section — it only removes the
  rule the owner pointed at.
- **Not in scope but noted:** `components/analyst-ratings.tsx:151` and
  `components/technical-analysis.tsx:198` use the same dead `border-line` idiom; the
  owner named only Intrinsic + News, so this plan changes only those two. The
  broader dead-`border-line` cleanup is logged as a follow-up (see Assumptions A3).

### Issue 3 — composite score flicker (this is the concrete flicker; do it before Issue 2)
- **File:** `components/overview.tsx:135-157`. The Overview "composite score" is
  derived from **five independent React Query calls** (chart/technical,
  fundamentals, analyst, intrinsic, news). The card's `isLoading` gate is
  **`chartQ.isLoading` only** (line 157). Each of the other four subscores falls
  back to a neutral `5` while its own query is still loading
  (`(intrinsicScore ?? 5)` etc., lines 144-148, where `intrinsicScore` etc. read
  `?.data` which is `undefined` mid-load and yields `5`).
- **Mechanism:** the chart query resolves first → the card renders a composite
  computed from one real subscore + four `5`s → as each remaining query resolves,
  `composite` recomputes and the 84px headline number visibly jumps (e.g. `5.8` →
  `6.3` → `5.9`). This is exactly "shows one number, then quickly changes to
  another." Same effect drives the SubscoreBand dimension figures (a `5` shown for
  Fundamental/Analyst/Intrinsic/Sentiment until each resolves — feeds Issue 2 too).
- **Distinguishing the two flicker classes (per the task):** this is
  **(b) show-placeholder-then-real** (a fabricated neutral `5` shown before the real
  input arrives), NOT (a) stale-then-fresh. React Query's `staleTime` (5–60 min
  here) means there is no background refetch within a session that would swap a
  cached value for a fresh one on open — the flicker is purely the initial
  resolve-order of five parallel first-loads. So the fix is "don't compute/show the
  composite until its inputs have resolved," not "suppress a stale value."
- **The `5` neutral fallback for a genuinely errored/absent dimension stays** — it
  is documented behavior (overview.tsx:77-84, the composite intentionally
  substitutes neutral `5` for a missing input). The bug is only that a *still-loading*
  query is indistinguishable from a *resolved-with-no-data* one. The fix must
  distinguish `isLoading`/`isPending` (hold back) from resolved-empty (neutral `5`).

### Issue 3b — the Intrinsic "0.0/10" is a REAL score, not a placeholder (owner question)
- **File:** `components/intrinsic-value.tsx:74` → `upsideToScore(data.upsidePercent)`
  (`lib/utils/research-scores.ts:20-27`). `upsideToScore` returns `5` for a `null`
  upside (no fundamental data), and `0.0` only when `upsidePercent <= -25%`
  (clamped floor). A €148.70 fair value with a current price well above it produces
  a large negative upside → a legitimate `0.0`. So the screenshot's `0.0/10` is a
  correct "significantly overvalued" score, **not** a not-yet-computed placeholder
  masquerading as a score. No code change proposed for 3b; flagged as an Open
  decision (OD-1) only so the owner can confirm they read it as intended rather
  than as the same flicker bug.

### Issue 2 — flash of empty structure on open
- **Route skeletons are correct and NOT the cause.** `app/(dashboard)/*/loading.tsx`
  (dashboard, research/[symbol], etc.) render shape-matched `loading-skeleton.tsx`
  primitives and are the expected treatment (DESIGN.md "Loading skeleton").
- **The flash is component-level, on the research-detail Overview tab.** Two
  surfaces render populated-looking structure before data resolves:
  1. **The composite HeadlineScoreCard / SubscoreBand** — same root as Issue 3:
     `overview.tsx` gates the whole card on `chartQ.isLoading` only, so the card
     appears with four subscore figures showing a fabricated `5` and a composite
     built from them, before those four queries resolve. Fixing Issue 3 (gate the
     card body / individual figures on per-query pending state) removes this flash.
  2. **The Overview price chart** (`DetailPriceChart`, rendered above the card) has
     its own `animate-pulse` skeleton and is fine.
- **Dashboard:** `app/(dashboard)/dashboard/page.tsx` returns `null` while
  `isLoading` (line 65) and is covered by `dashboard/loading.tsx`, so the dashboard
  hero/stat band do not flash empty. The dashboard is therefore NOT the primary
  surface for Issue 2 — the research Overview tab is. (If the owner meant the
  dashboard specifically, see Assumptions A1.)
- **Scope decision:** the highest-impact, clearly-reproducible empty-structure
  surface is the Overview composite card, and it is the *same* fix as Issue 3.
  Other tabs (Technical/Fundamental/Analyst/Intrinsic/News) each already gate on
  their own `isLoading` with a centered "Loading…" state (verified:
  `intrinsic-value.tsx:52`, `news-feed.tsx:94`), so they do not flash empty. This
  plan fixes the one surface that does; no ocean-boiling.

### Issue 4 — axis domain / gridline-label mismatch (the real bug)
- **File:** `components/portfolio-chart.tsx` (dashboard hero, ADR-10) with the
  scaling in `lib/utils/chart-path.ts:52-55`. The latent same-shape bug also exists
  in `components/research/detail-price-chart.tsx`.
- **Root cause — the plotted line and the axis labels use two different vertical
  mappings:**
  - `buildPath` (chart-path.ts:52-55) maps the series so **data-min plots at pixel
    `height - padding`** and **data-max plots at pixel `padding`** (`padding = 8`,
    `CHART_HEIGHT = 220`). So the line occupies pixels **8 … 212**.
  - The gridlines are drawn at **fixed** pixels `55 / 110 / 165`
    (`portfolio-chart.tsx:221-223`, `GRIDLINE_Y` line 39), and the y-axis tick
    **labels** (`niceYTicks(yMin, yMax, 3)` = `[max, mid, min]`, line 153) are
    positioned at those same fixed pixels (line 203).
  - Result: the label "max" sits at pixel 55, but the actual data-max point is
    plotted at pixel 8 — **~47px above** the top gridline/label. Likewise data-min
    plots at pixel 212, ~47px **below** the bottom label at 165. Any real
    max/min point therefore renders outside the labelled band — precisely "goes
    above/below the axis range." The sharp spike in the screenshot is simply the
    max point; it is drawn correctly relative to the *line's* own domain but the
    *labels* imply a smaller range, so it reads as overflowing.
- **This is a scaling bug, not (necessarily) a bad data point.** The y-domain used
  to draw the line IS derived from the plotted series (correct), but the axis
  chrome (gridlines + labels) is pinned to a fixed fraction of the viewBox that
  does not correspond to where `buildPath` places min/max. The fix is to make the
  gridlines and their labels sit where the plotted values actually land.
- **Fix approach:** compute each gridline's y-pixel from the *same* padded domain
  `buildPath` uses, so tick `yTicks[i]` renders at the pixel where that value plots:
  `y(v) = padding + (1 - (v - yMin) / (yMax - yMin)) * (height - 2*padding)`. With
  `niceYTicks` returning `[yMax, mid, yMin]`, the top line lands at `padding` (8),
  the bottom at `height - padding` (212), and mid centered — so the line's extremes
  sit exactly on the top/bottom gridlines and inside the labels. Export a small
  pure helper (`gridlineYs(yMin, yMax, height, padding, ticks)` in
  `lib/utils/chart-path.ts` or a new `lib/utils/chart-scale.ts`) so it is unit
  tested and shared by both charts, matching the project's "chart math is a pure,
  tested helper" convention (ADR-10/11, AGENT.md fragile surfaces). Keep `padding`
  in sync with `buildPath`'s default (8) — pass it explicitly, do not re-hardcode.
- **Bad-data-point sub-cause (secondary, note only):** a single garbage point (e.g.
  an FX-conversion glitch — the screenshot shows "Rates: USD/EUR 0.8750") would
  still be a legitimate max and would still be *inside* the fixed line after this
  fix, just correctly labelled. The owner's literal complaint ("goes out of the
  axis range") is the scaling bug and is fully addressed by the domain fix. Guarding
  against genuinely bad provider points (clamp/exclude outliers) is a separate
  data-quality concern — see Open decision OD-2; not fixed here unless the owner
  asks, because excluding a real spike would hide a real event.

## Approach

- **Issue 1:** delete `border-t border-line` (keep `pt-5`) on the two named band
  wrappers. Trivial CSS. Designer confirms the DESIGN.md spec change (the two bands
  lose their top rule) — see Notes for the Designer stage.
- **Issue 3 + Issue 2 (one fix, same root):** in `overview.tsx`, stop showing the
  composite card and its subscore figures until their inputs have *resolved*.
  Two viable shapes — pick per Designer input (see Notes), default to the simpler:
  - **Default (gate the card):** extend the card's loading gate from
    `chartQ.isLoading` to "any of the five subscore queries is still pending" and
    render the existing centered "Loading overview…" state (already present,
    overview.tsx:194-197) until all five resolve. Simple, no new visual token, kills
    both the composite flicker and the empty-figure flash in one move.
  - **Alternative (per-figure skeleton):** keep the card, but render each subscore
    figure and the composite as a `SkeletonBlock`/`—` until its query resolves.
    More granular but introduces a visible loading treatment inside the card
    (needs the Designer to bless it against DESIGN.md). Only take this if the
    Designer prefers progressive reveal over a single hold.
  - Either way: preserve the documented neutral-`5` fallback for a query that
    *resolved* with no usable data or errored (overview.tsx:77-84 semantics
    unchanged) — the change only distinguishes *pending* from *resolved-empty*.
- **Issue 4:** replace the fixed `GRIDLINE_Y` pixel positions with domain-derived
  positions via a shared, unit-tested pure helper; apply to both
  `portfolio-chart.tsx` and `detail-price-chart.tsx` so the two charts stay
  consistent (both currently share the identical latent bug). Gridline `<line>` y
  coords and the HTML tick-label `top` values both read from the helper.

## Tasks

Grouped by issue; ordered so the shared-root items (3 then 2) are adjacent and the
chart fix (4) is last. Each task independently verifiable.

**Issue 1 — divider removal [trivial CSS]**
1. [ ] Remove `border-t border-line` (keep `pt-5`) from the Bear/Base/Bull grid
   wrapper in `components/intrinsic-value.tsx:113`. — Acceptance: Intrinsic value
   tab renders the BEAR/BASE/BULL band with no horizontal rule above it; column
   spacing unchanged; `npm run verify` green.
2. [ ] Remove `border-t border-line` (keep `pt-5`) from the tone grid wrapper in
   `components/news-feed.tsx:116`. — Acceptance: News & sentiment view renders the
   POSITIVE/NEUTRAL/NEGATIVE band with no rule above it; spacing unchanged.

**Issue 3 + Issue 2 — composite flicker / empty-structure flash [behavioral-rendering]**
3. [ ] In `components/overview.tsx`, gate the composite HeadlineScoreCard (and its
   SubscoreBand figures) so it is not shown with fabricated `5`s while any of the
   five subscore queries is still pending; hold the existing "Loading overview…"
   state (or per-Designer per-figure skeleton) until all resolve. Preserve the
   neutral-`5` fallback for resolved-empty/errored dimensions. — Acceptance: on a
   fresh open of a research symbol's Overview tab, the composite score and the five
   dimension figures appear only once with their final values — no visible jump
   from an interim number, and no band of `5`s shown before data arrives. Verify by
   throttling network (DevTools Slow 3G) and watching the Overview tab: the score
   figure must not change value after first appearing.

**Issue 4 — performance chart axis domain [chart-data-logic]**
4. [ ] Add a pure `gridlineYs(yMin, yMax, height, padding, ticks)` helper (in
   `lib/utils/chart-path.ts` or new `lib/utils/chart-scale.ts`) computing each
   tick's y-pixel from the same padded domain `buildPath` uses, with unit tests
   (top tick at `padding`, bottom at `height - padding`, mid centered; flat-series
   and single-tick degenerate cases). — Acceptance: unit tests pass; for
   `height=220, padding=8, ticks=[max,mid,min]`, top→8, bottom→212.
5. [ ] Wire `portfolio-chart.tsx` to draw its gridlines and position its y-axis
   labels from `gridlineYs(...)` instead of the fixed `GRIDLINE_Y = [55,110,165]`,
   passing `buildPath`'s padding. — Acceptance: on the dashboard Performance chart,
   the plotted line's highest and lowest points sit ON the top and bottom
   gridlines (never above/below them), and the top/bottom tick labels align with
   those extremes. Verify visually with a spiky series (the reported case).
6. [ ] Apply the same domain-derived gridline/label positioning to
   `components/research/detail-price-chart.tsx` (fixed `GRIDLINE_Y=[47,94,141]` of
   190), so the two charts stay consistent and the latent same bug there is closed.
   — Acceptance: research Overview/Technical charts keep the line within the
   labelled band; reference-line clamping (detail-price-chart.tsx:146) still works.

[Task status markers — Coding agent maintains these here:]
[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `components/intrinsic-value.tsx` (Issue 1)
- `components/news-feed.tsx` (Issue 1)
- `components/overview.tsx` (Issues 2 + 3)
- `lib/utils/chart-path.ts` or new `lib/utils/chart-scale.ts` + its `.test.ts`
  (Issue 4 helper + tests)
- `components/portfolio-chart.tsx` (Issue 4)
- `components/research/detail-price-chart.tsx` (Issue 4)
- `DESIGN.md` — Designer-stage updates (Issue 1 rule removal; any loading treatment
  chosen for Issue 3/2). Planner does not pre-edit; Designer owns these.

## Verification

`## Verify` block in AGENT.md (`npm run verify`) runs automatically — typecheck,
lint, tests, secret-scan. Beyond it, manual/visual checks:

- **Issue 1:** Intrinsic value + News & sentiment tabs show no rule above their
  column bands; spacing visually unchanged. Light + dark mode.
- **Issue 2/3:** Throttle network (DevTools Slow 3G), open a research symbol,
  select Overview: the composite score and five dimension figures must appear once
  with final values — no interim number, no `5`-band flash.
- **Issue 4:** On the dashboard Performance chart with a spiky range (reproduce the
  reported case, e.g. the range that showed the Jul-20 spike), confirm the line's
  max/min touch the top/bottom gridlines and never render outside them; tick labels
  match the plotted extremes. Repeat on the research Overview 1Y chart. Light + dark.

## Assumptions

- **A1 — "opening a page" (Issue 2) = the research-detail Overview tab.** The
  dashboard already returns `null` under a shape-matched route skeleton and does not
  flash empty structure; the reproducible component-level empty-structure flash is
  the Overview composite card. If the owner meant a *different* page, that surface
  would need its own diagnosis (flag in review). Deprioritized-but-checked:
  Technical/Fundamental/Analyst/Intrinsic/News tabs each already gate on their own
  `isLoading`.
- **A2 — Issue 3's flicker = the Overview composite score** (the one score that
  recomputes from five staggered queries). No other score in the app is assembled
  from multiple independently-resolving sources in the same render, so this is the
  score the owner saw change.
- **A3 — `border-line` is a dead no-op class app-wide**, but only the two named
  bands are changed here. The broader cleanup (analyst-ratings.tsx:151,
  technical-analysis.tsx:198, fundamental-analysis.tsx, transactions-tab.tsx) is
  logged for a follow-up `TECH_DEBT.md` entry by the Coding agent, not fixed in
  this plan (owner asked for these two bands specifically).
- **A4 — Issue 4 fix is the axis-domain (scaling) fix only.** Bad-provider-point
  clamping/exclusion is not included (see OD-2) — the owner's literal complaint is
  the axis range, which the domain fix fully resolves.

## Open decisions

**RESOLVED 2026-07-20 by owner:**
- **OD-1 → "0.0 is correct, no change."** The intrinsic 0.0/10 is a genuine deeply-overvalued score; owner is content it displays as-is. No code change (Issue 3b confirmed not-a-bug).
- **OD-2 → "just fix the axis."** The scaling fix (Task 4-6) proceeds; the Jul-20 spike is treated as real data, no bad-point clamping/exclusion. Bad-data investigation is out of scope.

Original text retained below.

- **OD-1 — Intrinsic "0.0/10" (Issue 3b): confirm it reads as intended.** It is a
  genuine "significantly overvalued" score (fair value far below current price),
  not a placeholder — no code change proposed. Owner: confirm you are content that
  `0.0` displays for a genuinely deeply-overvalued symbol (vs. wanting a different
  floor treatment, e.g. showing the number differently). Non-blocking for Issues
  1/2/3/4; only blocks if the owner actually wants the score presentation changed.
- **OD-2 — Issue 4 bad-data-point handling: in or out?** The scaling fix makes a
  real spike sit correctly inside the labelled axis. If the owner instead believes
  the spike is a *garbage* value (e.g. an FX glitch) that should be
  clamped/excluded, that is a separate data-quality task in the performance API /
  chart series, not the axis fix. Default: out of scope (excluding a real spike
  would hide a real event). Owner to confirm.

## Notes for the Designer stage

The Designer stage runs for the parts that change documented visual spec.

- **Issue 1 — divider removal (DESIGN.md updates required):**
  - `DESIGN.md` "Headline score card" → Right column entry (~line 307-312):
    the "Intrinsic 3-col scenario band" and "News 3-col tone band" slots currently
    inherit a top rule from the band wrapper; document that these two bands have
    **no top rule** (the band sits flush under the card's internal content with
    `pt-5` spacing only).
  - `DESIGN.md` UX flows → Research detail → Intrinsic value entry (~line 795-800)
    and the News tone-band description (~line 382): note the scenario/tone band has
    no divider above it.
  - Confirm consistency: **both** bands lose the line (owner asked for both). Note
    for the Designer: `analyst-ratings.tsx`'s price-target band and Technical's
    table use the same idiom but are **out of scope** here — the Designer should
    decide separately whether the system should converge (all such bands lose the
    rule) or keep those; this plan does not touch them.
  - Clarify in DESIGN.md that `border-line` is a dead token (no `--line` var); the
    real rule was `border-t`. This prevents a future spec re-adding `border-line`
    expecting it to draw.
- **Issue 2/3 — loading treatment (only if the per-figure-skeleton alternative is
  chosen):** if the Coding agent takes the "single hold on the existing
  'Loading overview…' state" default, **no new visual token** is introduced and no
  DESIGN.md change is needed. If the Designer prefers progressive reveal (per-figure
  skeleton), reference the existing `components/ui/loading-skeleton.tsx` primitives
  (`SkeletonBlock`, `SkeletonText`) and DESIGN.md "Loading skeleton" section — do
  not invent a new shimmer; reuse `SkeletonBlock`. Designer picks; default is the
  no-new-token hold.
- **Issue 4 — no new visual token.** The axis fix only relocates existing gridlines
  and labels to where the data actually plots; the line stays within the plot area.
  Designer confirmation is only "the line no longer overflows the axis" — no
  DESIGN.md token change beyond, optionally, a one-line note that gridline positions
  are data-derived, not fixed fractions of the viewBox.
