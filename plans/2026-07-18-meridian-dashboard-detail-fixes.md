# Plan: Meridian dashboard + detail-page bug fixes

Date: 2026-07-18

Stacks onto branch `feature/meridian-research-detail` (PR #14, open, unmerged, built on
top of the unmerged `feature/meridian-design-overhaul`). Do NOT branch off `main` — that
would duplicate unmerged work. The Coding agent continues on this same branch.

## Problem

The owner found a set of bugs while testing the Meridian branch locally at
`localhost:3000`. Two areas:

### A. Dashboard
1. **Performance chart has no hover tooltip.** `components/portfolio-chart.tsx` (the
   dashboard hero SVG, ADR-10) has the range-morph animation but no hover
   crosshair/marker/tooltip. Hovering gives no value/date readout.
2. **Performance chart has no y-axis.** No y-axis value labels on the hero chart.
   The research-detail `DetailPriceChart` already has the exact desired treatment
   (a few `--mut` labels via `niceYTicks`).
3. **Table rows barely highlight on hover.** Every clickable table/list row uses
   `hover:bg-fill/45`, which Tailwind emits as
   `color-mix(in srgb, var(--fill) 45%, transparent)` — this is *exactly* the
   README §Interactions formula, but `--fill` (`#f3f0e9`) at 45% over `--bg`
   (`#faf8f4`) is nearly invisible on the warm paper background. The owner's mock-up
   screenshot reads as a distinct visible band, so the intended effect is stronger
   than both the README text ("very subtle") and the current implementation. The
   hover must be bumped to a clearly-visible-but-still-editorial fill, applied
   consistently to ALL clickable rows (currently two idioms coexist — see Approach).

### B. Detail pages
4. **Position-detail page (`/portfolio/[ticker]`) is not styled as designed.** The
   owner's ENGI.PA screenshot shows old-shadcn quote cards ("Market Value /
   Unrealized P/L / Today's Change / Avg Cost" — rounded `Card` chrome, lucide
   icons, `text-green-600`/`text-red-600` figures) at the top of the view. Those
   exact strings and that chrome exist ONLY in
   `app/(dashboard)/portfolio/[ticker]/page.tsx` — this is the position-detail
   page, which DESIGN.md and TECH_DEBT.md **TD-32** explicitly deferred from the
   Meridian overhaul (it is not one of the 7 designed screens; the single designed
   detail screen is Research detail, and `/research/[symbol]` already implements it
   faithfully). The task promotes TD-32's header + quote-card region to done. A
   secondary audit of `/research/[symbol]` against the mock-up produced no material
   structural gaps (see Approach → item 4).
5. **Overview / Fundamental / Intrinsic tabs full-card-fail on thin-coverage
   symbols** (e.g. ENGI.PA, where a provider lacks analyst/fundamental/intrinsic
   data). Three distinct root causes, all "all-or-nothing" failures where a scoped
   empty state should show instead:
   - **Overview** (`components/overview.tsx:142`): `hasError` ORs *all five* query
     error states; ANY one failing replaces the entire composite-score card with
     "Some data failed to load" (lines 183-187) — even though each subscore already
     defaults to a neutral `5` when its query has no data. One dead upstream API
     wipes a card that could render fine.
   - **Intrinsic value** (`components/intrinsic-value.tsx` +
     `intrinsic-value.service.ts:36`): the service throws
     `"No fundamental data available"` → API 500 → full-card fail whenever the DB
     `FundamentalData` cache is empty for the symbol (thin coverage, OR the
     fundamentals fetch failed, OR the intrinsic tab is opened before fundamentals
     have ever been cached). This is a genuine bug even on well-covered symbols if
     the cache is cold.
   - **Fundamental** (`components/fundamental-analysis.tsx:73`): `if (error || !data)`
     full-card-fails on any API 500. `fundamentals` API 500s when Yahoo's
     `quoteSummary` throws for the symbol (thin coverage / bad symbol). Note: when
     the API returns 200, the service always returns a fully-shaped object with
     `null` metrics, so the component's `data.score.breakdown.*` accesses are safe —
     the failure is 500-propagation, not a shape bug.

Both `/portfolio/[ticker]` and `/research/[symbol]` render these same three tab
components, so the fix repairs both pages at once.

## Approach

### Item 1+2 — dashboard chart hover + y-axis (recommend: port shared primitives, do NOT merge components)

`future_ideas.md` already scoped this exact promotion and named the reuse path:
`niceYTicks` (`lib/utils/chart-ticks.ts`, already unit-tested) and the crosshair
pixel-mapping approach in `DetailPriceChart`. **Recommendation: port those two
primitives into `portfolio-chart.tsx` in place — do NOT merge the two chart
components.** Rationale:
- ADR-11 and the AGENT.md fragile-surface entries are explicit that the hero chart
  and `DetailPriceChart` are deliberately *distinct* components (the hero has
  range-morph + a 220-tall viewBox; the detail chart has hover/y-axis + variable
  viewBox and no morph). Merging them would fight both ADRs and risk the morph.
- `niceYTicks` is already a shared, tested pure helper — the hero can import it
  directly. Only the crosshair/tooltip JSX and the mousemove→index math need to be
  ported (copied and adapted), because the hero's data lives in `animatedValues`
  (morph state), not in a `points[]` array. This is a ~30-line addition, not an
  extraction.

Concrete hero-chart changes (`components/portfolio-chart.tsx`):
- **Y-axis:** wrap the `<svg>` in a `relative pl-14` container (mirroring
  `DetailPriceChart`), compute `niceYTicks(min, max, 3)` from the *displayed*
  `animatedValues` (finite-filtered), and render 3 `--mut` HTML labels absolutely
  positioned at the hero's gridline y-fractions (55/110/165 of 220 — the hero's
  existing gridlines, NOT the detail chart's 47/94/141 of 190). Use
  `formatCurrency(tick, baseCurrency)`. Labels update live as the morph runs (that
  is acceptable and matches how the value figure animates elsewhere).
- **Hover crosshair + tooltip:** add a `containerRef` + `hoverIndex` state and
  `onMouseMove`/`onMouseLeave` on the SVG's container, computing the nearest index
  from `animatedValues.length` exactly as `DetailPriceChart` does. Render the same
  three overlay elements — vertical `--line` crosshair, `--foreground` marker dot,
  and a `--card`/`border-border` shadow-free tooltip — showing the hovered point's
  date (from the `labels`/`data.series` dates) and `formatCurrency(value)`. The
  tooltip's date must come from the raw `data.series` date at `hoverIndex`, not the
  sparse `labels` array (which only holds ~5 picked labels). Pull the full date
  series into a ref/state alongside `animatedValues` so the tooltip can read
  `series[hoverIndex].date`.
- **Coexistence with morph (the one real risk):** the crosshair reads
  `animatedValues[hoverIndex]` for the marker's y-position, so during a 500ms morph
  the marker rides the animating line — acceptable and visually correct. The
  mousemove handler must not cancel or restart the RAF morph. Keep `hoverIndex`
  independent of the morph effect. Acceptance verification drives a hover during and
  after a range change to confirm the morph is intact.
- Do NOT change `lib/utils/chart-path.ts` or its tests — the path math is untouched.

### Item 3 — unify table row hover to a visible fill

Two idioms exist today, both equal to the near-invisible README value:
- `hover:bg-fill/45` — `components/positions-table.tsx:63`,
  `components/wishlist-table.tsx:211`,
  `app/(dashboard)/portfolio/closed-positions/page.tsx:281`,
  `app/(dashboard)/research/page.tsx:63`, `components/stock-search.tsx:112`.
- `hover:bg-[color:color-mix(in_srgb,var(--fill)_45%,transparent)]` —
  `components/news-feed.tsx:144` (the longhand of the identical value).

Fix: raise the hover to a clearly-visible editorial fill and apply it identically to
every clickable row. **Recommended value: solid `hover:bg-fill`** (`--fill` at full
alpha) — still a warm neutral, no new token, distinctly visible on both light and
dark surfaces, and it reads as the "distinct band" in the mock-up screenshot. This is
a Designer decision (it overrides the README's "very subtle" text); record the
corrected value in DESIGN.md's "Row hover" spec so the two files no longer disagree.
Replace both idioms with `hover:bg-fill` across all six call sites so there is one
row-hover treatment, not three. (The `wishlist-item-card.tsx` `bg-blue-50`/etc.
hovers are a separate stock-shadcn surface not part of any Meridian table and are out
of scope here — flag if seen but do not touch.)

### Item 4 — position-detail page Meridian header + quote card (TD-32)

Reskin the header + quote-card region of `app/(dashboard)/portfolio/[ticker]/page.tsx`
to the Meridian patterns already built for `/research/[symbol]`, reusing existing
tokens/components — no new tokens, no new patterns:
- Replace the back link + `text-2xl font-bold` ticker H1 + shadcn action `Button`s
  with the research-detail header shape: serif 52px company name over a
  `TICKER · EXCHANGE` `--mut` kicker (DESIGN.md company-header spec), and pill-shaped
  primary/secondary action buttons (`bg-btnbg`/`--btnfg` and transparent + `--line`
  border) for Buy more / Sell / Delete, matching the research-detail pill treatment.
- Replace the 5 shadcn `Card` quote tiles (Market Value / Unrealized P/L / Realized
  P/L / Today's Change / Avg Cost, with lucide icons and `text-green-600`/`red-600`)
  with a Meridian ruled quote card. Two equally-faithful options for the Coding agent
  to choose per what reads best (this is presentational, within the tone rules — see
  Assumptions): (a) the Research-detail **4-col ruled quote grid** (the exact
  `grid-cols-4 rounded-lg border border-border bg-card` block at
  `research/[symbol]/page.tsx:122-155`), or (b) the **card-wrapped ruled stat band**
  variant (DESIGN.md "Ruled stat band"). Either way: kicker (10.5px uppercase
  `--mut`) / serif value (26-28px) / detail line per cell, `--line2` internal
  verticals, signed figures colored `--up`/`--dn` via the token aliases (never
  `text-green-600`), no lucide icons, no shadows.
- Replace the shadcn `Tabs`/`TabsList`/`TabsTrigger` bar with the Meridian
  research-detail tab bar (DESIGN.md "Segmented tabs" — `flex gap-8 border-b`,
  uppercase 11px kicker tabs, active = weight 600 + 2px `--ink` underline). The tab
  *bodies* already render the shared Meridian tab components (`Overview`,
  `TechnicalAnalysis`, etc.) — leave those wiring calls intact; only the tab chrome
  changes.
- Remove the now-unused lucide icon imports and `Card`/`Badge`/`Tabs` imports left
  after the reskin. Keep `ComponentErrorBoundary`, the modals, and all data-fetching
  logic exactly as-is — this is presentational only, no behavior change.
- After this lands, update TD-32: the header + quote-card + tab-bar chrome are done;
  if any lower sections remain stock-shadcn, narrow TD-32's scope to just those
  rather than closing it outright (the Coding agent decides based on what it finds —
  the visible screenshotted region is the required deliverable).

**`/research/[symbol]` audit result:** the page already implements the mock-up §5
Research detail faithfully — 4-col ruled quote grid (page.tsx:122-155), correct
7-tab bar, shared Meridian tab components, correct tokens. No material structural gap
was found against the mock-up. The remaining known deltas are all pre-existing,
documented *data gaps* (TD-DTL-SR/SEG/TGT/REV/SCEN/ASSUMP/TONE/SECTOR), each already
rendering a correct editorial em-dash/empty-state placeholder — out of scope here
(they are backend data-coverage items, not styling bugs). No task is created for
`/research/[symbol]` styling.

### Item 5 — per-dimension graceful degradation (never all-or-nothing)

Apply one principle to all three tabs: a single failed/absent sub-query or a cold
cache must degrade only *that* piece (neutral/placeholder), never blank the whole
card. No scoring-logic changes (scoring surfaces are presentational — render whatever
the services return; ADR constraint). No new endpoints.

- **Overview** (`components/overview.tsx`): delete the `hasError` all-or-nothing gate
  (line 142 + the branch at 183-187). Each subscore already defaults to `5` on
  missing data, so the composite + `SubscoreBand` already compute correctly from
  partial data. Render the `HeadlineScoreCard` whenever the *chart* query (the one
  that drives the price chart and technical subscore) has resolved; for each of the
  five dimensions whose query errored, show a neutral/placeholder treatment in the
  `SubscoreBand` (a `--mut` em-dash figure or the `null` band per DESIGN.md's
  "null/unavailable → `--mut`" rule) rather than silently substituting `5` as if it
  were real. Keep the top-level loading state (the initial full-tab spinner) only
  while the *chart* query is loading; do not gate the whole card on the slowest of
  five independent queries. `SubscoreBand`/`ScoreFigure` already support a
  `null`/unavailable band — pass `null` for a failed dimension instead of a
  fabricated `5` so the UI is honest about missing data (verify `ScoreFigure`
  accepts `null`; if it does not, this is a small presentational prop addition, not a
  scoring change).
- **Intrinsic value** (`components/intrinsic-value.tsx` + its service consumption):
  the component must render its `HeadlineScoreCard` shell with scoped em-dash
  placeholders (fair value "—", "No fair-value estimate available", the existing
  Bear/Base/Bull and assumptions placeholders) instead of the full-card
  `AlertCircle` failure when the API returns the "no fundamental data" condition.
  Preferred fix at the *component* boundary (no backend change): treat a 500/404
  "no fundamental data" response as an empty state, not an error — i.e. distinguish
  "service could not value this symbol" (scoped empty state, render the shell) from a
  genuine network/parse error (keep a failure state). If the API's current 500 body
  cannot be distinguished from a real 500, the minimal backend-side option is to have
  the intrinsic-value route return a 200 with a well-formed "unavailable" payload
  (`intrinsicValue: null, methods: []`) when the service throws the specific
  `"No fundamental data available"` sentinel — this is a bug fix (wrong status code
  for an expected data-absence condition), not a new endpoint; the Coding agent picks
  whichever is cleaner and records the choice. Also migrate this component off its
  manual `useEffect`+`fetch` to React Query for consistency (TD-15 touches this file;
  fold it in since we're already editing the fetch path) — optional but preferred.
- **Fundamental** (`components/fundamental-analysis.tsx`): the full-card fail is
  API-500 propagation when Yahoo throws. Keep a failure state for a genuine error,
  but confirm the well-covered path (AAPL) renders end-to-end, and ensure a
  thin-coverage symbol that returns 200-with-nulls renders all rows as em-dash
  placeholders (already handled by the `fmt*` helpers returning `null` →
  `GradedMetricRow` unavailable dot). If ENGI.PA specifically 500s here (Yahoo
  throwing), the honest outcome is a scoped "Fundamental data unavailable for
  {symbol}" empty state — which the current code already shows; the acceptance check
  is that it is a *scoped, styled* empty state, not a crash, and that it does NOT
  block the other tabs. No graceful-degradation change is required here beyond
  confirming behavior unless the audit finds an unguarded throwing access.

**Two-problem check (task item 5b):** verify on AAPL (well-covered) that all three
tabs FETCH and render real numbers — to separate "(a) full-card fail on thin coverage"
from "(b) a genuine render/parse bug even on well-covered symbols." The intrinsic
cold-cache 500 (root cause 2 above) is exactly a class-(b) bug and is the most likely
to bite AAPL too if the intrinsic tab is opened first. Enumerate any additional
class-(b) bug found during the Playwright pass as a new task or a TECH_DEBT entry.

## Tasks

Ordered so the clear-cut, independently-verifiable fixes and the diagnosed runtime
fixes come first; the position-detail reskin (larger, presentational) comes after.

1. [x] **Unify table row hover to a visible fill.** Replace `hover:bg-fill/45` and the
   longhand `color-mix` variant with `hover:bg-fill` at all six call sites
   (`positions-table.tsx:63`, `wishlist-table.tsx:211`,
   `closed-positions/page.tsx:281`, `research/page.tsx:63`, `stock-search.tsx:112`,
   `news-feed.tsx:144`). Update DESIGN.md's "Row hover" spec to the new value.
   — Acceptance: `grep -rn "bg-fill/45\|color-mix(in_srgb,var(--fill)_45%" components app`
   returns nothing; Playwright hover over a dashboard positions-table row shows a
   clearly visible warm band; the same value appears on watchlist, closed-positions,
   research-index, and news-coverage rows.

2. [x] **Add y-axis price labels to the dashboard hero chart.** In
   `portfolio-chart.tsx`, wrap the SVG in a `relative pl-14` container and render 3
   `--mut` `formatCurrency` labels via `niceYTicks(min,max,3)` at the hero's gridline
   y-fractions (55/110/165 of 220), positioned as HTML text against the container
   (not inside the `preserveAspectRatio="none"` SVG). — Acceptance: Playwright loads
   `/dashboard`, sees 3 y-axis value labels aligned to the gridlines; labels update
   after a range-tab change; `npm run verify` green.

3. [x] **Add hover crosshair + tooltip to the dashboard hero chart.** Add
   `containerRef` + `hoverIndex` + mousemove/mouseleave to `portfolio-chart.tsx`,
   reusing `DetailPriceChart`'s pixel-mapping. Render the `--line` crosshair,
   `--foreground` marker dot, and `--card`/`border-border` shadow-free tooltip showing
   date (from `data.series[hoverIndex].date`) + `formatCurrency(value)`. Must not
   disturb the RAF morph. — Acceptance: Playwright hovers the hero chart and sees a
   crosshair + dot + tooltip with a date and value; triggers a range change, hovers
   again mid/after morph, confirms morph still animates and tooltip still tracks;
   `npm run verify` green (path-chart tests unchanged and passing).

4. [x] **Fix Overview all-or-nothing error gate.** Remove `hasError` (overview.tsx:142)
   and the "Some data failed to load" branch; render the composite card whenever the
   chart query has resolved; pass `null` (→ `--mut` unavailable band) for any
   dimension whose query errored instead of a fabricated `5`. — Acceptance: Playwright
   opens `/research/ENGI.PA` Overview tab — the composite score + 5-col dimension band
   renders (no full-card "failed to load"), with any uncovered dimension shown as a
   `--mut` placeholder; `/research/AAPL` Overview shows five real subscores.

5. [x] **Fix Intrinsic value full-card fail on cold/absent fundamentals.** Make the
   component render its shell with scoped em-dash placeholders when the service reports
   "no fundamental data" (distinguish data-absence from a true error; if needed, have
   the intrinsic route return 200-with-`intrinsicValue:null` for the
   `"No fundamental data available"` sentinel — a status-code bug fix, not a new
   endpoint). Optionally migrate this file to React Query (TD-15). — Acceptance:
   Playwright opens `/research/ENGI.PA` Intrinsic value tab and sees the headline card
   with "—" fair value + "No fair-value estimate available" (no full-card AlertCircle);
   `/research/AAPL` Intrinsic value shows a real fair-value figure even when opened as
   the first tab (cold cache); `npm run verify` green.

6. [x] **Confirm/repair Fundamental tab degradation.** (Audit only — `fundamental-analysis.tsx`'s `error || !data` already renders a scoped, styled empty state, not a crash, and doesn't block other tabs; `calculateFundamentalScore` always returns numeric breakdown values so the component's `data.score.breakdown.*` accesses are safe. No unguarded throwing access found; no code change made. Confirmed further via the Task 8 Playwright pass.) Verify AAPL renders all metric
   rows with real values, and a thin-coverage symbol renders em-dash placeholders (not
   a crash); ensure a genuine 500 shows a scoped, styled "unavailable" empty state that
   does not block other tabs. Fix any unguarded throwing access found. — Acceptance:
   Playwright — `/research/AAPL` Fundamental shows populated metrics + subscore band;
   `/research/ENGI.PA` Fundamental shows either populated/placeholder rows or a scoped
   styled empty state (never an unstyled crash), and switching to other tabs still
   works.

7. [x] **Reskin the position-detail header + quote card + tab bar to Meridian
   (TD-32).** In `app/(dashboard)/portfolio/[ticker]/page.tsx`: replace the shadcn
   header (back link, bold ticker H1, `Button` actions) with the research-detail serif
   header + `TICKER · EXCHANGE` kicker + pill actions; replace the 5 shadcn `Card`
   quote tiles with a Meridian ruled quote card (4-col ruled grid or card-wrapped stat
   band — Coding agent picks), signed figures via `--up`/`--dn` aliases, no lucide
   icons, no shadows; replace the shadcn `Tabs` bar with the Meridian tab bar
   (leave tab *bodies* wiring intact). Remove now-unused imports. Update TD-32. — 
   Acceptance: Playwright opens `/portfolio/{an owned ticker}` and sees the Meridian
   serif header + ruled quote card (no rounded shadowed cards, no lucide icons, no
   `text-green-600`/`red-600`) + Meridian tab bar; all tabs still render; delete/buy/
   sell modals still open; `npm run verify` green.

8. [~] **Playwright end-to-end verification pass + doc updates.** Drive dashboard
   (chart hover, chart y-axis, table-row hovers) and both detail routes for AAPL
   (well-covered) and ENGI.PA (thin coverage) across all 7 tabs, confirming no
   full-card "failed to load" blanking and correct Meridian styling. Update
   `future_ideas.md` (remove the hero-chart hover/y-axis item — now done, cite ADR/
   plan), `AGENT.md` (correct the fragile-surface note that says the hero chart has
   "no hover marker/crosshair/tooltip and no y-axis labels" — it now does; note the
   ported `niceYTicks`/crosshair reuse), and add a short ADR if the intrinsic route's
   status-code behavior changes. — Acceptance: all of §Verification passes; docs
   reflect reality; `npm run verify` green.

[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `components/portfolio-chart.tsx` — add y-axis labels + hover crosshair/tooltip
  (Tasks 2, 3). Import `niceYTicks`, `formatCurrency`.
- `components/positions-table.tsx`, `components/wishlist-table.tsx`,
  `components/stock-search.tsx`, `components/news-feed.tsx`,
  `app/(dashboard)/portfolio/closed-positions/page.tsx`,
  `app/(dashboard)/research/page.tsx` — unify hover to `hover:bg-fill` (Task 1).
- `components/overview.tsx` — remove `hasError` gate, per-dimension degradation (Task 4).
- `components/intrinsic-value.tsx` — scoped empty state, optional React Query (Task 5).
- `app/api/research/[symbol]/intrinsic-value/route.ts` — *only if* the 200-with-null
  approach is chosen for the "no fundamental data" sentinel (Task 5).
- `components/fundamental-analysis.tsx` — only if an unguarded throwing access is found
  (Task 6).
- `app/(dashboard)/portfolio/[ticker]/page.tsx` — Meridian header + quote card + tab bar
  (Task 7).
- `DESIGN.md` — corrected "Row hover" value; note the hero chart now has hover/y-axis
  (Designer stage, Task 1/8).
- `AGENT.md` — correct the hero-chart fragile-surface entry (Task 8).
- `future_ideas.md` — remove the completed hero-chart hover/y-axis item (Task 8).
- `TECH_DEBT.md` — update/narrow TD-32; (TD-15 if intrinsic migrated to React Query).
- `DECISIONS.md` — new ADR only if the intrinsic route's response contract changes.

## Verification

`## Verify` block in AGENT.md (`npm run verify`) runs automatically — do not restate.
Beyond it, a **Playwright / browser pass** (the failures are all runtime/visual and
invisible to unit tests):

Dashboard (`/dashboard`):
- Hover the performance chart → crosshair + marker dot + tooltip (date + value) appear;
  leaving the chart hides them.
- Y-axis shows a few (3) `--mut` value labels aligned to the gridlines.
- Change the range tab, then hover again → morph still animates AND tooltip tracks the
  new series; y-axis labels update.
- Hover a positions-table row → clearly visible warm fill band. Repeat on the
  watchlist, closed-positions, research-index, and news-coverage rows → identical fill.

Detail pages — drive BOTH a well-covered symbol (`AAPL`) and a thin-coverage symbol
(`ENGI.PA`), on `/research/[symbol]` AND `/portfolio/[ticker]` (for an owned symbol),
across all 7 tabs (Overview · Technical · Fundamental · Analysts · Intrinsic value ·
Transactions · News & sentiment):
- No tab shows a full-card "Some data failed to load" / AlertCircle blanking on
  ENGI.PA. Overview renders the composite + dimension band (uncovered dimensions as
  `--mut` placeholders); Intrinsic renders its shell with em-dash placeholders;
  Fundamental renders placeholders or a scoped styled empty state — never a crash.
- On AAPL, Overview/Fundamental/Intrinsic all render REAL numbers (class-(b) check),
  including opening Intrinsic value FIRST (cold-cache path).
- Position-detail (`/portfolio/{owned}`): Meridian serif header, ruled quote card,
  Meridian tab bar — no rounded shadowed cards, no lucide icons, no
  `text-green-600`/`red-600`. Buy-more / Sell / Delete modals still open.

Record concrete results (screenshots / observed states) in the review, per the ADR-11
precedent for browser-verified chart interactions.

## Assumptions

- **Row hover = solid `hover:bg-fill`.** The task directs a stronger hover than the
  README's "very subtle" text; solid `--fill` (no new token) is the recommended
  editorial value. The Designer stage records this in DESIGN.md; if the Designer
  prefers a different visible alpha (e.g. `bg-fill/70`), that substitution is within
  scope as long as it is applied to all six call sites and recorded in DESIGN.md.
- **Item 4 scope = the position-detail header + quote-card + tab-bar chrome** (the
  screenshotted region), reusing existing research-detail patterns — not a
  full pixel-audit reskin of every sub-section of `/portfolio/[ticker]`. The mock-up
  has no "position detail" screen to diff against; `/research/[symbol]` is the
  designed detail screen and already matches. If the Coding agent finds additional
  stock-shadcn chrome in lower sections of the position-detail page, it narrows TD-32
  to cover it rather than expanding this task's scope silently.
- **Intrinsic quote card variant** (4-col ruled grid vs card-wrapped stat band) and the
  intrinsic "unavailable" wire-up (component-side vs 200-with-null route) are
  presentational/implementation choices left to the Coding agent within the stated
  constraints — either is faithful; the agent records which it chose.
- **No scoring-logic changes.** All scoring surfaces render whatever the services
  return; the open scoring-methodology review is out of scope (task constraint).
- **No new backend endpoints.** The only permitted backend edit is the intrinsic-value
  route's status code for the data-absence sentinel (a bug fix), if that approach is
  chosen over the component-side fix.
- **No hardcoded colors.** All new UI references Meridian Tailwind token aliases
  (ADR-8); no hex/oklch/`hsl(var(` literals.

## Open decisions

None — the task's directives resolve the one design conflict (row-hover strength) and
the one scope ambiguity (position-detail vs research-detail), both recorded above as
Assumptions the owner approves with this plan.
