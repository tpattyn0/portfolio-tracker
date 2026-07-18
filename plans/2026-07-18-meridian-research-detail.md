# Plan: Meridian editorial design for the research (stock) detail views
Date: 2026-07-18

## Problem

The 2026-07-17 Meridian overhaul (`plans/2026-07-17-meridian-design-overhaul.md`,
`implemented`) reskinned the app shell and the six primary screens, but deliberately
scoped the **research detail** route (`/research/[symbol]`) shallow: the price chart
kept Recharts "retokenized only" and the detail tabs were not given the full editorial
treatment. The Overview tab already carries the Meridian composite-score card and verdict
stamp (that was in scope last time); the other tabs (Technical / Fundamental / Analysts /
Intrinsic value / News & sentiment) still render the old stock-shadcn `Card`/`Badge`/
`Progress` look, and there is no Transactions tab.

The refreshed design handoff (`design_handoff_meridian/README.md` §5 "Research detail" +
`Meridian Hybrid.dc.html` lines 461–1021) now fully specifies this screen: **7 tabs** in a
new order, editorial headline cards with 84px scores and rotated verdict stamps, a
Fundamental **pill sub-nav**, subscore bands, an analyst ratings-distribution + price-target
band, DCF scenario bands, a sentiment tone band, a revenue-by-segment bar list, and a
grading-dot system (● green / amber / red) on fundamental metrics.

This plan applies that design to the detail views ("re-skin + structure", per owner
decision 1): reskin every existing tab, add the new structural elements, add the 7th
Transactions tab reusing existing data, and render graceful placeholders where the design
shows data the app does not have — with each gap logged as tech debt. **No new backend
endpoints, no scoring-logic changes.** The tokens, fonts, and `.dark` theming from the
prior overhaul are reused as-is (ADR-8/9/10) — this plan does not re-plan them.

## Approach

### Guiding rules (carried from the prior overhaul)

- **Tokens exist — reference them, never hardcode.** Use the Tailwind aliases already
  wired: `bg-card`, `border-border`, `text-mut`, `text-sub`, `text-up`, `text-dn`,
  `text-amber`, `bg-fill`, `border-line2`, `bg-btnbg`/`text-btnfg`, `font-serif`,
  `font-sans`. Double rules are `style={{ borderTop: "3px double var(--foreground)" }}`
  as the Overview card already does. Do NOT add `hsl(var(--x))` anywhere (ADR-8 / AGENT.md).
- **The Overview tab (`components/overview.tsx`) is the reference implementation.** Its
  editorial score-breakdown card (double-rule top border, 84px banded score, rotated verdict
  stamp, 5-col dimension grid, №-numbered key-insights) is exactly the headline-card pattern
  every other tab's headline card must match. Reuse its structure; do not reinvent it.
- **Scoring surfaces are presentational only.** Render whatever the current API returns.
  The 84px scores, subscore bands, grading dots, and verdict stamps recolor already-computed
  numbers against the DESIGN.md band thresholds (score ≥7 green, 4–7 amber, <4 red; and the
  fundamental sub-score thresholds). The open scoring-methodology review is OUT of scope and
  must not be touched.
- **Placeholders, not fabrication.** Where the design shows data the app does not have
  (see Data-gap map below), render a quiet editorial empty state ("Not available", em-dash,
  or a muted italic caption) using real tokens — never invent numbers. Log each gap in
  `TECH_DEBT.md`.

### Shared Meridian building blocks (build once, reuse across tabs)

To avoid re-implementing the same markup five times, extract these into small presentational
components under `components/research/` (new folder). All are pure/presentational — they take
already-computed values as props.

1. **`HeadlineScoreCard`** — the double-rule-top editorial headline used by Technical,
   Fundamental, Analysts, Intrinsic, and News tabs. Props: kicker title + right-aligned
   meta kicker, an 84px banded score with `/10` suffix, an optional rotated verdict stamp,
   an optional verdict kicker + italic serif summary, and a `children` slot for the
   right-hand column (dimension grid / chart / distribution / scenario band / tone band).
   This generalises the card `overview.tsx` already contains — refactor Overview to consume
   it too, so all six headline cards are literally the same component (one source of truth).
2. **`ScoreFigure`** — the banded serif numeral (already inline in `overview.tsx` as
   `ScoreDimension` / the 84px block). Extract a `ScoreFigure` that takes `score` + `size`
   and applies the band color via a shared `scoreBandClass(score)` helper (Task 2).
3. **`VerdictStamp`** — the `3px double` rotated stamp (inline in `overview.tsx` today).
4. **`SubscoreBand`** — the N-col ruled band of subscores (Fundamental's 5-col Valuation/
   Profitability/Growth/Health/Dividend; also reused for Overview's 5-dimension grid).
5. **`GradedMetricRow`** — label (muted) + value (weight-500) + a grading dot
   (`● --up/--amber/--dn`) in a `justify-between` row with a `1px --line2` bottom rule.
   The dot color comes from `gradingDotClass()` (Task 2).
6. **`MeridianTable`** wrapper is NOT needed — tables are simple enough to write inline with
   the shared header/row classes documented in DESIGN.md's "Position/Watchlist table row"
   section; follow that ruling (10.5px uppercase `--mut` headers, `1px --line` header
   bottom, `1px --line2` row dividers, serif 15.5px name cells where the design uses serif).

### The detail chart component (owner decision 4) — extend the Meridian SVG, do not fork

**Decision: extend the existing custom Meridian SVG chart into a reusable
`components/research/detail-price-chart.tsx` and retire `components/price-chart.tsx`
(Recharts) from the detail tabs.** See ADR-11 below for the full rationale. The prototype
draws BOTH the dashboard hero chart and the detail Overview/Technical charts with the same
`buildPath` Catmull-Rom function (`Meridian Hybrid.dc.html` lines 486–493 for Overview
viewBox `0 0 1300 190`, lines 544–552 for Technical viewBox `0 0 1000 190` with two dashed
reference lines) — they are the same chart at different viewBoxes, so pixel-parity with the
dashboard requires the SAME path builder, which Recharts cannot match (ADR-10 established
this). `price-chart.tsx` stays only as long as nothing else imports it; confirm and delete.

The new `DetailPriceChart` reuses `buildPath`/`buildAreaPath` from `lib/utils/chart-path.ts`
(no change to that file) and adds, as **props**, the two owner-required behaviours plus the
optional dashed reference lines:

- **Y-axis price labels (owner requirement).** A small, fixed number of value labels (3–4,
  matching the 3 gridlines the prototype draws at y=47/94/141 for the 190-tall viewBox).
  Render them as HTML text absolutely positioned against the chart container (not inside the
  `preserveAspectRatio="none"` SVG, which would distort text) at the gridline y-fractions,
  formatted with `formatCurrency`. Tick values come from a new pure helper
  `niceYTicks(min, max, count)` (Task 2, unit-tested) that returns a few round-ish values
  spanning the series range. Keep it minimal per the owner ("a few, not a dense axis").
- **Hover tooltip + crosshair (owner requirement).** An `onMouseMove` over the plotted area
  maps cursor x → nearest data index (the series is evenly spaced, so
  `round(cursorFrac * (n-1))`), then renders (a) a thin vertical `--line` crosshair at that
  x, (b) a small `--ink` marker dot on the line at that point, and (c) an HTML tooltip
  (card bg, `1px --line`, small) showing the point's date and `formatCurrency(price)`.
  Hidden on `onMouseLeave`. Because the SVG uses `preserveAspectRatio="none"`, compute the
  marker/crosshair pixel position from the container's measured client width (via a ref),
  not from viewBox units, so the dot lands under the cursor. The path stays in viewBox units.
- **Dashed reference lines + legend (Technical tab).** Optional `referenceLines?: Array<{
  value: number; label: string; color?: string }>` prop. Each renders as a horizontal
  `stroke-dasharray="6 5"` `--mut` line at the value's y-fraction, plus a caption in the
  legend row beneath the chart ("Resistance $216.80 ┄ · Support $208.20 ┄"), matching
  prototype lines 548–555. Support/resistance values are a **data gap** (see map) — when
  absent, render the chart with no reference lines and omit the legend (no fabricated levels).

Range tabs: Overview's chart shows the 1-year view (prototype has no range tabs on the
detail Overview chart — it is a static 1Y card); Technical's shows 6 months. Keep it simple:
`DetailPriceChart` takes a `period` prop and fetches `/api/market/chart/${symbol}?period=…`
via React Query (matching the existing `PriceChart` data path). No range-tab row on the
detail charts unless a later pass wants it — the prototype does not show one here.

**Scope note (owner decision 4):** the existing dashboard hero chart
(`components/portfolio-chart.tsx`) does NOT currently have hover tooltips or y-axis labels,
and this plan does **not** add them there — the owner said adding them to the hero is
"acceptable but call it out as a scope note", and the hero has its own range-morph behaviour
that hover/crosshair would interact with. Adding hover + y-axis to the hero is deferred to
`future_ideas.md` (logged in Task 12) rather than bundled here, to keep this plan's
verification surface to the detail views. The new hover/y-axis/reference-line code lives in
`DetailPriceChart`; if the hero later wants it, the shared primitives (`niceYTicks`, the
crosshair math) are already extracted and unit-tested.

### Data-gap map (design element → real API → gap handling)

Read each API by signature above; map every detail-view element to real data where it exists.

| Tab / element | Real data source | Gap handling |
|---|---|---|
| Company header (name · exchange · **sector**) | `/api/market/quote` (name, exchange) | Sector is not in the quote shape today → omit the "· Consumer technology" sector clause when absent (kicker shows `TICKER · EXCHANGE` only). Log TD. |
| Quote 4-col stat card | `/api/market/quote` (price, change, dayLow/High, yearLow/High, marketCap) | Fully available — already rendered in `page.tsx`, keep. |
| Overview composite + 5 dimensions + key insights | Existing `overview.tsx` derivation (chart/fundamentals/analyst/intrinsic/news) | Fully available — refactor to shared components, keep logic. |
| Overview 1Y chart | `/api/market/chart?period=1Y` | Available. Swap Recharts `PriceChart` → `DetailPriceChart period="1Y"`. |
| Technical headline (84px score, verdict kicker, italic summary) | `/api/market/chart` `indicators.score` / `signal` | Available. Verdict kicker + summary derived from score band (reuse Technical's existing summary strings). |
| Technical 6M chart + dashed support/resistance + legend | `/api/market/chart?period=6M` for the line | Support/resistance **not computed** by the technical service → render chart with no reference lines + no legend when absent. Log TD-DTL-SR. |
| Technical Indicators table (Indicator/Reading/Interpretation/Signal) | `indicators` (RSI, MACD, SMA50/200, volumeTrend + `breakdown[*].signal`) | Available — map each indicator to a row; Signal cell = BUY/NEUTRAL/SELL from `breakdown` signal (bullish→BUY green, neutral→NEUTRAL amber, bearish→SELL red). Rows for indicators returning null are omitted. |
| Fundamental headline (84px + 5-col subscore band) | `/api/market/fundamentals` `score.total` + `score.breakdown.{valuation,profitability,growth,financial,dividend}` | Available. `financial`→"Health". |
| Fundamental pill sub-nav (Overview / Valuation / Profitability / Growth / Health / Dividend) | Same fundamentals payload | Structure is new; metrics available. Build all 6 sub-views. |
| Fundamental Overview sub-view: 2-col score-breakdown grid w/ grading dots + legend | `fundamentals.valuation/profitability/growth/financial/dividend` metrics | Metric values available. **Grading dots vs peers**: `IndustryComparison` is unpopulated (AGENT.md), so "vs peers" is not real → dots use the existing per-metric good/bad thresholds already encoded in `fundamental-analysis.tsx`'s `MetricRow` (not peer comparison). Legend copy stays "Strong / In line / Weak" but log TD-DTL-PEER that the comparison is threshold-based, not peer-relative. |
| Fundamental "Revenue by segment" bars | **No segment data** in fundamentals API | Full data gap → render the "Revenue by segment" card with a quiet empty state ("Segment breakdown not available"). Log TD-DTL-SEG. |
| Analysts headline (84px + BUY stamp) | `/api/market/analyst-ratings` `score` | Available. |
| Analysts ratings-distribution rows (Strong buy…Strong sell w/ bars + counts) | `analyst-ratings` `strongBuy/buy/hold/sell/strongSell/totalAnalysts` | Available — bar width = count/total. |
| Analysts 3-col price-target band (Low / Median / High + upside) | `analyst-ratings` `targetPrice` (mean only) | Only the **mean** target is returned; Low/High are **not** in the `AnalystRatings` shape → render the band with Median populated and Low/High as em-dash placeholders. Log TD-DTL-TGT. |
| Analysts "Recent revisions" table | `upgradeDowngradeHistory` is fetched by the service but **not returned** in the API shape | Full data gap in the response → render the card with an empty state ("No recent revisions on file"). Log TD-DTL-REV. (Do NOT change the service to expose it — that is backend work, out of scope.) |
| Intrinsic headline (84px + fair value $ + "trading X above/below") | `/api/research/[symbol]/intrinsic-value` `intrinsicValue`, `upsidePercent`, and a score | Fair value + upside available. The 84px **score** is derived in `overview.tsx` via `upsideToScore()` — reuse that helper (extract to a shared util) so the Intrinsic tab's headline score matches the Overview dimension. |
| Intrinsic 3-col scenario band (Bear / Base / Bull) | **Not computed** — service returns a weighted point estimate + methods[], no scenarios | Full data gap → render the scenario band with Base = the point estimate and Bear/Bull as em-dash placeholders (or omit Bear/Bull cells with a muted "single-point estimate" caption). Log TD-DTL-SCEN. |
| Intrinsic "Model assumptions" rows (rev growth / FCF margin / WACC / terminal growth) | `methods[]` inputs expose per-method `growthRate`, `discountRate` (DCF Lite), etc. | Partial: DCF Lite's `inputs` contains `growthRate` and `discountRate` — surface those two as "Revenue growth" and "Discount rate (WACC)". FCF margin + terminal growth are not modelled → em-dash placeholders. Log TD-DTL-ASSUMP. |
| Transactions 4-col stat band (Shares held / Avg cost / Market value / Unrealised P/L) | `/api/portfolio/positions/[ticker]` (returns quantity, avgCostBasis, marketValue, unrealizedPL, unrealizedPLPercent) | Available **only when the stock is in the portfolio** (route 404s otherwise) → graceful empty state (see Transactions tab). |
| Transactions table (Date / Type / Shares / Price / Fees / Total) | `/api/portfolio/transactions?ticker=` (existing) | Available. Type badge: BUY = outlined green pill, SELL/other = muted outlined pill. (The design shows a DIVIDEND type; the schema's `Transaction.type` is `BUY`/`SELL` only — DIVIDEND is a data gap, render whatever types exist. Log TD-DTL-TXTYPE.) |
| News headline (84px + trend kicker + italic summary) | Derived sentiment score (reuse `overview.tsx` sentiment derivation) | Score available. Trend kicker ("Warming") derived from score band. |
| News 3-col tone band (Positive / Neutral / Negative % + MoM delta) | Current tone %: computed from analyzed articles (`/api/news`). MoM delta: `/api/sentiment/[symbol]/history` | Current-period % available from article counts. **MoM delta** needs a prior-30-day baseline — history exists but computing a clean MoM delta is non-trivial; render the three % values and omit the "+9 pts vs prior month" delta line when history is thin. Log TD-DTL-TONE. |
| News "Latest coverage" list (serif headline / source · date / tag) | `/api/news` (title, source, publishedAt, sentiment→POSITIVE/NEUTRAL/NEGATIVE) | Available — reskin the existing `news-feed.tsx` list into the editorial hairline-divided list. |

### Tab structure and order (owner decision, matches design)

`page.tsx` tab array becomes 7 tabs in this order (currently 6, different order):
`Overview · Technical · Fundamental · Analysts · Intrinsic value · Transactions · News & sentiment`.
Tab bar styling already matches the design in `page.tsx` (uppercase kicker, 2px ink underline
on active) — keep it, just add the Transactions entry and reorder. Tab state stays client-side.

## Tasks

Ordered so shared primitives land before the tabs that consume them. Each task keeps
`npm run verify` green (the AGENT.md `## Verify` block) and is independently checkable.

1. [x] **Shared band/tick pure helpers + tests** — add `lib/utils/score-band.ts` exporting
   `scoreBandClass(score: number|null): string` (≥7 `text-up`, 4–7 `text-amber`, <4
   `text-dn`, null `text-mut`), `gradingDotClass(status: "strong"|"inline"|"weak"): string`,
   and a `metricGrade(value, {goodThreshold, badThreshold, inverse})` that reproduces the
   existing `fundamental-analysis.tsx` `MetricRow` threshold logic as a pure function
   returning `"strong"|"inline"|"weak"|null`. Add `lib/utils/chart-ticks.ts` exporting
   `niceYTicks(min: number, max: number, count?: number): number[]`. Unit-test both files
   (`vitest`), following the `chart-path.test.ts` pattern (known input, degenerate: equal
   min/max, null/NaN). — Acceptance: `npm run verify` passes; new test files execute and
   cover the band boundaries (6.9→amber, 7.0→up, 3.9→dn) and a flat-series tick case.
2. [x] **Shared presentational components** — create `components/research/`:
   `headline-score-card.tsx` (`HeadlineScoreCard`), `score-figure.tsx`
   (`ScoreFigure` + `VerdictStamp`), `subscore-band.tsx` (`SubscoreBand`),
   `graded-metric-row.tsx` (`GradedMetricRow`). All consume Task 1 helpers and DESIGN.md
   tokens only (no hardcoded hex). — Acceptance: components typecheck and render in isolation
   (import into a scratch route or Storybook-free smoke render); `npm run verify` passes.
3. [x] **`DetailPriceChart` component (ADR-11)** — create
   `components/research/detail-price-chart.tsx` reusing `buildPath`/`buildAreaPath`
   (unchanged) with props `{ symbol, period, referenceLines? }`, y-axis labels via
   `niceYTicks`, hover crosshair + marker + date/price tooltip (container-ref pixel math,
   `preserveAspectRatio="none"`), and optional dashed reference lines + legend. Fetches
   chart data via React Query like `PriceChart`. — Acceptance: renders a line + area + 3
   gridlines + 3–4 y labels for a real symbol; hovering shows a tooltip with date + price and
   a crosshair; `npm run verify` passes. (Interaction verified in Task 11's Playwright pass.)
4. [x] **Refactor Overview onto shared components** — rewrite `components/overview.tsx` to
   consume `HeadlineScoreCard` + `ScoreFigure` + `VerdictStamp` + `SubscoreBand`, and swap
   its chart from `PriceChart` to `DetailPriceChart period="1Y"`. Extract its
   `upsideToScore`/`sentimentToScore` derivations into `lib/utils/research-scores.ts` (pure,
   tested) so Intrinsic and News tabs reuse them. Behaviour (composite math, verdict labels,
   insights) unchanged. — Acceptance: Overview renders visually identical to before but via
   shared components; composite score + verdict + dimensions match prior output for a known
   symbol; `npm run verify` passes.
5. [x] **Technical tab reskin** — rewrite `components/technical-analysis.tsx`: `HeadlineScoreCard`
   (84px score, verdict kicker, italic summary) with `DetailPriceChart period="6M"` in the
   right column (reference lines omitted — data gap), then an "Indicators" card with the
   4-col ruled table (Indicator / Reading / Interpretation / Signal), Signal cell colored
   BUY/NEUTRAL/SELL from `breakdown` signals. Drop all `Card`/`Badge`/`Progress`/`Star`
   shadcn chrome. — Acceptance: tab matches prototype lines 531–603 structure; indicators
   with null readings are omitted; `npm run verify` passes.
6. [x] **Fundamental tab reskin + pill sub-nav** — rewrite `components/fundamental-analysis.tsx`:
   `HeadlineScoreCard` + 5-col `SubscoreBand` (Valuation/Profitability/Growth/Health/Dividend),
   then a client-side **pill sub-nav** (Overview / Valuation / Profitability / Growth / Health /
   Dividend; active = filled ink pill, inactive = outlined `1px --line`). Build all six
   sub-views: Overview = 2-col score-breakdown grid of the five sections (serif name + subscore
   under a `3px double` rule, then 4 `GradedMetricRow`s) + legend + "Revenue by segment" card
   (empty-state placeholder); the other five = one card each with grouped metric sections
   (uppercase kicker group headings over a `1px --line` rule, 2-col `GradedMetricRow` grid) per
   prototype lines 715–840. Map existing `fundamentals.*` metrics into the groups; missing
   metrics render em-dash rows. Grading dots use `metricGrade()` (threshold-based). — Acceptance:
   all six sub-views switch client-side and render; grading dots appear with correct band
   colors on available metrics; `npm run verify` passes.
7. [x] **Analysts tab reskin** — rewrite `components/analyst-ratings.tsx`: `HeadlineScoreCard`
   (84px + `VerdictStamp`) with, in the right column, the 5-row ratings distribution (label /
   `--fill`-track colored bar / count) over the 3-col price-target band (Low/Median/High +
   upside; Low & High em-dash placeholders — data gap), then a "Recent revisions" card with an
   empty state (data gap). — Acceptance: distribution bars scale to counts; median target +
   upside show for a symbol with coverage; `npm run verify` passes.
8. [x] **Intrinsic tab reskin** — rewrite `components/intrinsic-value.tsx`: `HeadlineScoreCard`
   (84px amber-band score via `upsideToScore`, fair-value estimate figure, "Trading X%
   above/below fair value" line, italic note) with, in the right column, the 3-col scenario
   band (Base = point estimate; Bear/Bull em-dash placeholders — data gap) over "Model
   assumptions" rows (Revenue growth + Discount rate from DCF Lite `inputs`; FCF margin +
   terminal growth em-dash). Remove the old Recharts-free `Card`/`Dialog`/`Progress` chrome;
   the methods-detail dialog may be kept as a secondary "Details" affordance if it is
   retokenized, else dropped. Also update `page.tsx`'s inline "Comparative valuation metrics"
   block to the editorial style (or fold into the Valuation sub-view and remove from
   `page.tsx`). — Acceptance: fair value + upside + assumptions render; `npm run verify` passes.
9. [x] **Transactions tab (new, 7th)** — create `components/research/transactions-tab.tsx`:
   a ruled 4-col stat band (Shares held / Average cost / Market value / Unrealised P/L) fed by
   `/api/portfolio/positions/[ticker]` (React Query; on 404 / not-owned, render a quiet empty
   state: "You do not hold {symbol}." + the "+ Add to portfolio" pill, and no stat band), then
   a "Your transactions" card ("+ Add transaction" outlined pill linking to
   `/portfolio/add?ticker=`) with the editorial table (Date / Type / Shares / Price / Fees /
   Total) fed by `/api/portfolio/transactions?ticker=`. Type badge = outlined green BUY / muted
   outlined otherwise. Reuse/retire `components/transaction-history.tsx` (either reskin it into
   this tab or supersede it — do not leave two transaction tables in the detail flow). —
   Acceptance: for an owned symbol the stat band + table render; for an unowned symbol the empty
   state renders with no console error from the 404; `npm run verify` passes.
10. [x] **News & sentiment tab reskin** — rewrite `components/news-feed.tsx` (or wrap it):
    `HeadlineScoreCard` (84px sentiment score + trend kicker + italic summary) with a 3-col
    tone band (Positive/Neutral/Negative %; MoM delta line omitted when history is thin — data
    gap) in the right column, then a "Latest coverage" editorial list (serif 17px headline /
    `source · date` kicker / POSITIVE·NEUTRAL·NEGATIVE colored tag, hairline dividers, row
    hover). Drop the `Tabs`/`Card`/`Alert`/`Badge` shadcn chrome; keep the existing empty-state
    guidance content but retokenized. — Acceptance: tone % + coverage list render; sentiment tag
    colors match band; `npm run verify` passes.
11. [x] **Wire `page.tsx`: 7 tabs, new order, DetailPriceChart** — update the `tabs` array to
    the 7-tab order, add the Transactions entry, route each tab to its (re)built component, and
    remove the now-dead inline "Comparative valuation metrics" block if folded into Task 8.
    Add `ComponentErrorBoundary` around the tab content region (AGENT.md notes the research
    detail page currently has none). — Acceptance: all 7 tabs switch client-side and render the
    correct component; `npm run verify` passes; Playwright pass (see Verification) drives all 7.
12. [ ] **Docs + tech-debt + future-ideas** — update `DESIGN.md` (new named tokens/patterns
    from Task 2/3 — grading dot, headline score card, detail chart hover/y-axis; see DESIGN.md
    additions below), add `ARCHITECTURE.md` note that the detail charts now use the custom SVG
    (`DetailPriceChart`) and `price-chart.tsx` is retired, append ADR-11 to `DECISIONS.md`, log
    every `TD-DTL-*` gap in `TECH_DEBT.md` Backlog, and add "hover + y-axis on the dashboard
    hero chart" to `future_ideas.md`. — Acceptance: docs reflect reality; `TECH_DEBT.md` rows
    exist for SR / PEER / SEG / TGT / REV / SCEN / ASSUMP / TONE / TXTYPE / sector; `npm run
    verify` passes.

## Files to create or modify

**Create:**
- `lib/utils/score-band.ts` + `lib/utils/score-band.test.ts`
- `lib/utils/chart-ticks.ts` + `lib/utils/chart-ticks.test.ts`
- `lib/utils/research-scores.ts` + `lib/utils/research-scores.test.ts`
- `components/research/headline-score-card.tsx`
- `components/research/score-figure.tsx`
- `components/research/subscore-band.tsx`
- `components/research/graded-metric-row.tsx`
- `components/research/detail-price-chart.tsx`
- `components/research/transactions-tab.tsx`

**Modify:**
- `app/(dashboard)/research/[symbol]/page.tsx` (7-tab array, order, wiring, error boundary)
- `components/overview.tsx` (refactor onto shared components + DetailPriceChart)
- `components/technical-analysis.tsx` (full reskin)
- `components/fundamental-analysis.tsx` (full reskin + pill sub-nav)
- `components/analyst-ratings.tsx` (full reskin)
- `components/intrinsic-value.tsx` (full reskin)
- `components/news-feed.tsx` (full reskin)
- `components/transaction-history.tsx` (reskin into / supersede for the Transactions tab)
- `DESIGN.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADR-11), `TECH_DEBT.md`, `future_ideas.md`

**Retire (verify no other importers first, then delete):**
- `components/price-chart.tsx` (Recharts detail chart, replaced by `DetailPriceChart`).
  Also check `components/sentiment-score.tsx` — if it is only used inside the old news tab
  and its function is absorbed, retire it too; otherwise leave it.

## Verification

The AGENT.md `## Verify` block (`npm run verify` — typecheck + lint + tests + secret scan)
runs on every task and in CI; it is not restated here. Beyond it:

- **New pure-helper unit tests** (Tasks 1, 4) — `score-band`, `chart-ticks`,
  `research-scores` each get a `*.test.ts` following the `chart-path.test.ts` pattern
  (known input, band boundaries, degenerate/null cases). These run inside `npm run verify`.
- **Playwright / browser pass (owner decision 5), manual-driven, per the pipeline's Designer/
  Coding verification):** with the dev server running and a logged-in session, drive the
  research detail route for at least one **owned** symbol and one **not-owned** symbol and,
  for each of the **7 tabs**, confirm against `Meridian Hybrid.dc.html` §5:
  1. Overview — composite 84px score banded + rotated verdict stamp + 5-dimension band + №
     insights; chart renders with y-axis labels; hover shows date+price tooltip + crosshair.
  2. Technical — headline card + 6M chart; Indicators table with BUY/NEUTRAL/SELL signal
     colors; reference-line legend absent (data gap) without layout breakage.
  3. Fundamental — headline + 5-col subscore band; pill sub-nav switches all 6 sub-views;
     grading dots colored; "Revenue by segment" shows the empty state.
  4. Analysts — headline + BUY stamp; distribution bars scale to counts; median target shown,
     Low/High placeheld; "Recent revisions" empty state.
  5. Intrinsic — headline + fair value + "trading X above/below"; scenario band Base filled,
     Bear/Bull placeheld; assumptions rows (2 real, 2 placeheld).
  6. Transactions — owned symbol: 4-col stat band + table; not-owned: empty state, no 404
     console error.
  7. News & sentiment — headline + tone band %; coverage list with colored tags + hairlines.
  Toggle dark mode once and confirm tokens invert (no hardcoded light-only colors). Confirm no
  `box-shadow` crept onto any card (flat aesthetic) and no fourth accent hue appears.

## Assumptions

- **`DetailPriceChart` replaces Recharts on the detail tabs (ADR-11).** The prior overhaul
  intentionally kept Recharts on `price-chart.tsx` for its axes/tooltips (ADR-10). This plan
  supersedes that specifically for the detail Overview/Technical charts because the owner now
  requires (a) pixel-parity with the dashboard hero chart and (b) hover tooltip + y-axis
  labels — the parity requirement forces the same `buildPath`, and the hover/y-axis are being
  built fresh either way. ADR-11 records this as a scoped amendment to ADR-10, not a reversal
  of the "keep Recharts" reasoning (which was about avoiding rebuild cost that the owner has
  now chosen to pay). If the owner would rather keep Recharts and only retokenize, that
  changes Tasks 3/4/5 — flag before starting Task 3.
- **Grading dots are threshold-based, not peer-relative.** `IndustryComparison` is unpopulated
  (AGENT.md), so "vs peers" cannot be honored literally. Dots reuse the metric good/bad
  thresholds already in `fundamental-analysis.tsx`. The legend keeps the design's "Strong /
  In line / Weak" wording; TD-DTL-PEER records the discrepancy. If the owner wants the legend
  reworded to "Strong / Fair / Weak (vs. absolute thresholds)", that is a one-line copy change.
- **Register (`/register`) and the position-detail page are untouched** — out of scope per the
  prior overhaul's DESIGN.md UX-flows section; unchanged here.
- **Placeholder copy** for each data gap uses quiet editorial phrasing (em-dash / muted italic
  caption) consistent with DESIGN.md tone-of-voice; exact wording is a Designer/Coding detail,
  not a design-changing decision.
- **`components/sentiment-score.tsx` disposition** is left to the Coding agent to determine by
  import analysis at Task 10 — retire only if unused after the news reskin.

## Open decisions

None blocking. The one architectural choice (chart component: extend vs. fork vs. keep
Recharts) is resolved by ADR-11 below; if the owner disagrees with retiring Recharts on the
detail tabs, they should say so before Task 3 (flagged in Assumptions).

---

## Proposed DECISIONS.md entry

## ADR-11 — Custom Meridian SVG chart on the research detail tabs; retire Recharts there
- **Decision:** the research-detail Overview and Technical charts are rendered by a new
  `components/research/detail-price-chart.tsx` reusing `lib/utils/chart-path.ts`
  (`buildPath`/`buildAreaPath`, unchanged), with hover crosshair+tooltip, a minimal set of
  y-axis price labels (`niceYTicks`), and optional dashed reference lines as props.
  `components/price-chart.tsx` (Recharts) is retired from the detail flow and deleted once no
  importer remains. This scopes-amends ADR-10, which kept Recharts on the detail chart.
- **Evidence:** not-implemented (planned) — target files `components/research/detail-price-chart.tsx`,
  `lib/utils/chart-ticks.ts`, `app/(dashboard)/research/[symbol]/page.tsx`; source parity
  reference `design_handoff_meridian/Meridian Hybrid.dc.html` lines 486–493 (Overview,
  viewBox `0 0 1300 190`) and 544–555 (Technical, viewBox `0 0 1000 190`, two dashed
  reference lines), both drawn with the prototype's `buildPath`.
- **Tradeoffs:** gives up Recharts' built-in axis autoscaling and tooltip on the detail
  charts, so the hover interaction and y-axis ticks are hand-rolled (mitigated by extracting
  `niceYTicks` and the crosshair math as tested primitives). Gains pixel-parity with the
  dashboard hero chart (owner requirement) and satisfies the owner's hover-tooltip and
  y-axis-label requirements with one component the hero can later adopt. ADR-10's original
  "keep Recharts for axes/tooltips" reasoning was about avoiding rebuild cost — the owner has
  now chosen to pay that cost for parity, so this is a scoped amendment, not a contradiction.
- **Status:** proposed
- **Confidence:** Medium — the path math and viewBox parity are verifiable against the
  prototype; the hover pixel-mapping under `preserveAspectRatio="none"` needs the container-ref
  approach and is confirmed only by the Playwright interaction pass.

---

## DESIGN.md additions the Designer stage should make

Reference-only for the Designer/Coding agent — these are NEW named patterns/tokens the detail
views need that are not yet in DESIGN.md. No new *colors* are required (all use existing
`--up`/`--amber`/`--dn`/`--mut`/`--line2`/`--fill`/`--ink`):

- **Grading dot** — a `●` glyph colored by grade: `--up` strong / `--amber` in line / `--dn`
  weak / `--mut` unavailable, `margin-left:8px`, inline after a metric value. Legend row:
  "● Strong vs peers · ● In line · ● Weak vs peers" (note the threshold-based caveat).
- **Headline score card** — the double-rule-top editorial card (`border-top:3px double
  var(--ink)`) with a `280px 1fr` two-column grid: left = 84px `ScoreFigure` (`/10` suffix at
  30px `--mut`) + optional `VerdictStamp` or verdict kicker + italic serif summary; right =
  a flexible slot (dimension band / chart / distribution / scenario band / tone band). Used on
  Overview, Technical, Fundamental, Analysts, Intrinsic, News tabs — one component.
- **Subscore band** — N-col ruled band of `ScoreFigure`s at 28px, `1px --line2` verticals
  (5-col on Fundamental; also the Overview 5-dimension grid).
- **Detail price chart (`DetailPriceChart`)** — the retained-inline-SVG detail chart (ADR-11):
  viewBox `0 0 1300 190` (Overview) / `0 0 1000 190` (Technical), 3 `--line2` gridlines, ink
  line 1.5px, `--ink` 0.05 area fill, `--line` baseline; PLUS: a few `--mut` y-axis price
  labels at the gridline fractions, an `--ink` hover marker + `--line` vertical crosshair + a
  card tooltip (date + `formatCurrency` price) on `mousemove`, and optional `--mut`
  `stroke-dasharray="6 5"` reference lines with a legend row. Distinct from the dashboard hero
  `portfolio-chart.tsx` (which has the range-morph but not hover/y-axis).
- **Editorial coverage list** — hairline-`--line2`-divided list rows: serif 17px/500 headline
  over a `TICKER? source · date` kicker, with a right-aligned uppercase POSITIVE/NEUTRAL/
  NEGATIVE tag colored `--up`/`--mut`/`--dn`; row hover per the standard 45%-`--fill` rule.
- **Outlined type badge** (transactions) — BUY = `1px --up` border + `--up` text pill;
  other types = `1px --line` border + `--mut` text pill; 10px/600 uppercase, radius 10px.
