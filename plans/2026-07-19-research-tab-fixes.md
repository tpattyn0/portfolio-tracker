# Plan: Research-detail tab fixes (Analyst · Intrinsic · Positions · News)

Date: 2026-07-19

## Problem

The owner reported nine issues across four research-detail tabs, verified against
Engie SA (ENGI.PA). Each has been root-caused against the actual service + component
code and labelled by kind, because the most valuable output here is telling the owner
which "fixes" are real bugs vs. expected-empty vs. new features:

- **[UI]** straightforward presentational change.
- **[BUG]** we compute/fetch the value but render it wrong.
- **[MAPPING]** the data exists upstream / in a DB column but is never plumbed to the display.
- **[UPSTREAM-ABSENT]** Yahoo genuinely does not provide it → an empty state is *correct*; the fix is wording/fallback at most.
- **[FEATURE / DECISION]** the value is not computed anywhere → surfacing it truthfully needs new logic and a product decision.

### Root causes (file:line)

**Analyst tab (`components/analyst-ratings.tsx`, `lib/services/analyst-ratings.service.ts`, `app/api/market/analyst-ratings/[symbol]/route.ts`)**

1. **[BUG] "Buy" bar not rendering.** `components/analyst-ratings.tsx:32,34` — the BUY
   and SELL distribution rows use `color: "bg-up/70"` / `"bg-dn/70"` (an opacity
   modifier), while STRONG BUY/HOLD/STRONG SELL use solid `bg-up`/`bg-amber`/`bg-dn`.
   Per ADR-8, Tailwind emits `color-mix(in srgb, var(--up) 70%, transparent)` for an
   opacity modifier on these non-HSL CSS-variable colors. `--up` is `oklch(0.55 0.1 155)`
   (light); at 70% alpha over the `bg-fill` (`#f3f0e9`) track it is so washed out it
   reads as "not rendering." The bar *is* drawn and the width calc is correct (the
   count `10` renders fine); it is a **legibility bug from an off-spec opacity tint**.
   DESIGN.md's Analysts spec (line 785–786) and the Score-figure/band vocabulary use
   solid `--up`/`--amber`/`--dn` only — never tinted variants. The `/70` modifiers are
   ad-hoc inventions in this one component. Fix: remove the opacity modifiers, use solid
   band colors for all five rows.

2. **[MAPPING + BUG] Low / High target price show em-dash while Median renders.**
   Two layers:
   - **Service (`analyst-ratings.service.ts:99-109`)** maps only `financialData.targetMeanPrice`
     → `targetPrice`. Yahoo's `financialData` module (already fetched, line 55-62) also
     returns `targetLowPrice` and `targetHighPrice`, but the service never reads them,
     the `AnalystRatings` interface (lines 5-17) has no fields for them, the DB columns
     don't exist, and the API response therefore omits them.
   - **Component (`analyst-ratings.tsx:126,141`)** hardcodes LOW and HIGH to a literal
     `—`. So even if the service returned them, the component ignores them.
   Because the median (`targetMeanPrice`) IS present for ENGI.PA, the target-price data
   block exists upstream — Low/High are almost certainly present too and are simply not
   plumbed through. This is a **mapping fix** (service → interface → response) plus a
   **component fix** (render the mapped values, em-dash only when genuinely null).

3. **[UPSTREAM-ABSENT — mostly] "No recent revisions on file."** `analyst-ratings.tsx:147-152`
   hardcodes an empty state; the inline comment (TD-DTL-REV) already records the cause:
   `upgradeDowngradeHistory` **is fetched** by the service (`analyst-ratings.service.ts:59`)
   but is **never extracted, never stored, and never returned** in the API response.
   So today it is a **missing-mapping** to the display. HOWEVER: for a thin-coverage
   European ADR like ENGI.PA, Yahoo's `upgradeDowngradeHistory` is frequently empty even
   when it returns the module — so once plumbed through, the correct rendered result for
   ENGI.PA is *still* likely "no revisions." Scope: plumb the field through and render
   real revisions when present; keep the empty state (reworded) when the array is empty.
   This makes the empty state *earned* (verified upstream-absent) rather than a
   hardcoded lie. See Open decision OD-3 on whether to include this now or defer.

**Intrinsic value tab (`components/intrinsic-value.tsx`, `lib/services/intrinsic-value.service.ts`)**

4. **[BUG (mislabel) + FEATURE/DECISION] Revenue growth mislabelled; FCF margin & Terminal growth not computed.**
   - "Revenue growth −59.4%" is **mislabelled**. `intrinsic-value.tsx:73` reads
     `dcfLite.inputs.growthRate`, which the service (`intrinsic-value.service.ts:99-102,126`)
     sets to `g = Math.min(earningsGrowth, 0.15)` — i.e. **earnings** growth (capped at
     15%, uncapped on the downside), NOT revenue growth. The −59.4% is a genuine
     `earningsGrowth` value from `FundamentalData`, shown under the wrong label. The
     schema DOES have a real `revenueGrowth` column (`prisma/schema.prisma:138`) that is
     never surfaced here. **[BUG]** to fix the label / use the right field.
   - **FCF margin** and **Terminal growth** are em-dash because **the DCF Lite method
     never computes them.** DCF Lite is an *EPS-multiple* model
     (`EPS × (1+g)^5 × Terminal P/E ÷ (1+r)^5`, lines 97-133) — it has a terminal
     **P/E** and a discount rate, but no terminal **growth** rate and no free-cash-flow
     basis at all. So "FCF margin" / "Terminal growth" as classic perpetuity-DCF inputs
     **do not exist in this computation.** This is not a plumbing bug — the numbers were
     never produced. `FundamentalData` does carry `fcfPerShare`, `revenue`, `pfcfRatio`,
     and the margins, so an FCF margin is *derivable*, and terminal growth is a *fixed
     assumption* one could introduce — but both require new logic and a truthfulness
     decision (relabel to what's actually computed vs. build a real FCF DCF). See OD-1.

5. **[FEATURE/DECISION] No Bear / Bull case.** `intrinsic-value.tsx:106,118` hardcode
   BEAR and BULL to `—` with caption "Single-point estimate." The service
   (`intrinsic-value.service.ts:70-91`) computes exactly one number — the
   confidence-weighted average across the 5 methods (`calculateWeightedAverage`,
   lines 245-264) — and returns no scenario band. **Scenario logic is not implemented.**
   Surfacing a bear/bull range requires new computation and a choice of what defines the
   band. A low-risk default that surfaces *already-computed* values exists (min/max of
   the 5 methods' valid results = bear/bull, weighted average = base); a
   flex-the-assumptions scenario model is a larger, ADR-worthy feature. See OD-2.

**Positions tab (`components/research/transactions-tab.tsx`, both route pages)**

6. **[UI] Remove the "Your position" kicker heading.** Present at
   `transactions-tab.tsx:99` (closed state) and `:116` (held state). Owner wants it gone.
   Reconciled with item 7 below: the other tabs' cards carry their own header row
   (e.g. "ANALYST RATINGS"), so "no title" here means dropping the *standalone* kicker
   in favour of the card-with-header treatment item 7 introduces.

7. **[UI] Match the other tabs' card + header treatment.** The other tabs
   (`analyst-ratings.tsx:98`, `intrinsic-value.tsx:84`, `news-feed.tsx:104`) render their
   primary content inside `HeadlineScoreCard` (`components/research/headline-score-card.tsx`):
   a card with `border-t-[3px] border-double border-foreground` editorial top rule and a
   header row (`kicker` left, `metaKicker` right, `border-b border-line2` under it). The
   Positions "Your position" stat block currently uses the **bare, top-ruled band**
   (`transactions-tab.tsx:100,117` — `border-t border-line pt-5`, no card, per the
   superseded `plans/2026-07-19-positions-band-restyle.md`). Owner now wants it to read
   like the other tabs' card, i.e. a card wrapper with a header row (e.g. "POSITION").
   This is a **presentational change** to the "held" and "closed" panel states, wrapping
   them in the shared card idiom with a header row (see Designer notes). This supersedes
   the prior bare-band restyle and requires a DESIGN.md item-6 update (Designer stage).

8. **[UI] Make Positions the last tab.** Both route pages define `ALL_TABS` with
   `transactions` (label "Positions") in slot 6, before `news`
   (`app/(dashboard)/research/[symbol]/page.tsx:47-54`,
   `app/(dashboard)/portfolio/[ticker]/page.tsx:23-30`). Move the `transactions` entry
   to **last** (after `news`) in BOTH arrays. The conditional-visibility filter
   (`shouldShowPositionsTab`) and `effectiveTab` derivation are order-agnostic, so only
   the array order changes.

**News & sentiment tab**

9. **[UI] Remove the top "Sentiment Analysis" card.** The top card is `SentimentScore`
   (`components/sentiment-score.tsx`), rendered ONLY on the portfolio route
   (`app/(dashboard)/portfolio/[ticker]/page.tsx:340`), inside the `news` tab, above
   `NewsFeed`. The research route does NOT render it (`research/[symbol]/page.tsx:261`
   renders only `NewsFeed`) — so this issue is portfolio-route-only. `SentimentScore`
   consumes the same `newsArticles` React Query result that `NewsFeed` also uses, so the
   fetch stays; only the `<SentimentScore .../>` render (and its now-unused import) are
   removed. The lower "NEWS & SENTIMENT" card (`NewsFeed`) already renders its own
   score + tone breakdown and stays.

## Approach

Grouped by tab. Items 1, 6, 7, 8, 9 are unambiguous and proceed on approval. Item 2's
mapping (Low/High) is a concrete, low-risk plumbing fix and proceeds. Item 4's *label*
fix proceeds; item 4's FCF-margin/terminal-growth and item 5's bear/bull, and item 3's
revisions plumbing, are gated on the Open decisions below because they change what gets
built (new logic and/or reverse a documented DESIGN.md data-gap decision).

**Guardrails honoured:**
- Financial calc services stay pure/side-effect-free (AGENT.md). Any new derivation
  (item 2 Low/High, item 5 scenario range) is added to the existing service methods /
  interfaces, not inlined into a route or component.
- No `hsl(var(--x))` reintroduced; only existing Meridian tokens used (item 1).
- No schema migration unless an Open decision explicitly approves one (dev/prod share
  one DB, ADR-6). Item 2 and item 3 can be done **without** new DB columns by returning
  the fields on the live/formatted response and treating them as non-persisted (the
  24h cache would then lose them on a cache hit — see Task acceptance notes and OD-3).

## Tasks

### Analyst tab

1. [x] **[BUG] Fix the washed-out BUY/SELL distribution bars.** In
   `components/analyst-ratings.tsx` change `DISTRIBUTION_ROWS` (lines 30-36) so `buy`
   uses `bg-up` and `sell` uses `bg-dn` (remove the `/70` opacity modifiers). Keep
   `strongBuy`→`bg-up`, `hold`→`bg-amber`, `strongSell`→`bg-dn`. — **Acceptance:** on a
   symbol with a non-zero Buy count, the Buy bar renders as a solidly visible green bar
   proportional to its count; `npm run verify` green.

2. [x] **[MAPPING] Plumb Low / High target price through service → response, and render
   them.**
   - `lib/services/analyst-ratings.service.ts`: add `targetLowPrice: number | null` and
     `targetHighPrice: number | null` to the `AnalystRatings` interface (lines 5-17);
     in `extractRatings` (lines 82-110) read `financialData.targetLowPrice` /
     `financialData.targetHighPrice` (null-coalesced to `null`); include them in the
     returned object and in `formatCachedData`/`saveToDatabase` as applicable (see
     OD-3 for whether to persist — if not persisting, return them only from the fresh
     path and default to `null` on a cache hit).
   - `components/analyst-ratings.tsx`: extend `AnalystRatingsData` with the two fields;
     render LOW (line 125-127) and HIGH (line 139-142) via
     `formatCurrency(value, currency)` when non-null, else `—`. Keep the `text-dn`/`text-up`
     kicker/value coloring per DESIGN.md line 787-788.
   — **Acceptance:** for ENGI.PA (or any symbol whose `financialData` includes
   low/high), LOW and HIGH show real currency figures; a symbol that genuinely returns
   only a mean target still shows `—` for LOW/HIGH. Unit test the extractor's new
   mapping (present, and absent → null). `npm run verify` green.

3. [x] **[UPSTREAM-ABSENT / MAPPING — GATED on OD-3] Plumb analyst revisions through and
   render real revisions when present.** Only if OD-3 = "include now": extract
   `upgradeDowngradeHistory.history` in `analyst-ratings.service.ts` into a typed
   `revisions` array (firm, action, fromGrade, toGrade, date), add it to the response,
   and render it in `analyst-ratings.tsx`'s "Recent revisions" card as the
   firm/action/RAISED·HELD·LOWERED-tag/date table DESIGN.md line 790-794 already specs
   (unbordered colored tag, `--up`/`--mut`/`--dn`). Keep a reworded empty state
   ("No analyst revisions in the last 90 days.") when the array is empty. — **Acceptance:**
   a symbol Yahoo returns revisions for renders the table; ENGI.PA (empty upstream)
   renders the reworded empty state; unit test the extractor for populated + empty. If
   OD-3 = "defer", leave this task unchecked and update the TD-DTL-REV note wording only.

### Intrinsic value tab

4. [x] **[BUG] Fix the "Revenue growth" mislabel.** In `intrinsic-value.tsx` the
   assumption currently labelled "Revenue growth" (line 126-128) shows the DCF Lite
   *earnings*-growth input. Either (a) relabel it "Earnings growth (capped 15%)" to match
   what is computed, or (b) surface the real `revenueGrowth` from the response. Requires
   OD-1's resolution to know which; if OD-1 picks the honest-relabel option, this task
   becomes "relabel + add Terminal P/E and Discount rate as the two *real* assumptions."
   — **Acceptance:** the displayed assumption label matches the value's actual source
   (verified against `intrinsic-value.service.ts`); no fabricated numbers. `npm run verify` green.

5. [x] **[FEATURE/DECISION — GATED on OD-1] Model assumptions: replace or remove the
   non-computed FCF margin / Terminal growth rows.** Per OD-1's resolution — either
   relabel to the real DCF Lite inputs (Terminal P/E, Discount rate, Earnings growth,
   and optionally a derived FCF margin from `fcfPerShare × shares / revenue` if the
   inputs are present) and drop the two rows that describe a model we don't run; OR build
   a real FCF-perpetuity DCF that genuinely produces FCF margin + terminal growth. —
   **Acceptance:** every "Model assumptions" row shows a value that is actually used in
   (or honestly derived for) the computation; no row is a permanent hardcoded `—` that
   describes a non-existent model. `npm run verify` green.

6. [x] **[FEATURE/DECISION — GATED on OD-2] Bear / Base / Bull scenario band.** Per OD-2's
   resolution — default: in `intrinsic-value.service.ts`, after computing `methods`, also
   return `scenarioLow` = min and `scenarioHigh` = max of the valid method values (value
   > 0), with `intrinsicValue` staying the weighted base; extend `IntrinsicValueResult`
   and the route/component types; render BEAR = `scenarioLow`, BASE = weighted, BULL =
   `scenarioHigh` (`intrinsic-value.tsx:106,118`) with truthful captions (e.g. "Lowest of
   5 methods" / "Highest of 5 methods") — em-dash only when fewer than 2 methods are
   valid. The alternative (flex-assumptions model) is a larger build; if chosen, an ADR
   is required (band definition). — **Acceptance:** for a symbol with ≥2 valid methods,
   Bear ≤ Base ≤ Bull with real figures and truthful captions; a symbol with 0-1 valid
   methods shows `—` for Bear/Bull; unit test the low/high derivation. `npm run verify` green.

### Positions tab

7. [x] **[UI] Adopt the other tabs' card + header treatment for the position stat block;
   remove the standalone "Your position" kicker.** In
   `components/research/transactions-tab.tsx`, wrap the "held" (lines 114-149) and
   "closed" (lines 97-112) panel bodies in the shared card idiom the other tabs use —
   a card with the editorial top rule + a header row ("POSITION" left kicker, optional
   right meta) — replacing the bare `border-t border-line pt-5` band and deleting the
   `"Your position"` standalone kicker (lines 99, 116). Follow the Designer stage's exact
   spec (see "Notes for the Designer stage" + the DESIGN.md item-6 update). Keep the
   `getPositionsPanelState` three-way gating and the `hasRealizedPL` 4-vs-5-col rule
   (AGENT.md fragile-surface entries — do NOT re-gate Realized P/L on `quantity`).
   — **Acceptance:** the Positions stat block visually matches the other tabs' card
   header treatment; the "Your position" text no longer appears; held shows the stat
   band (4/5 col) inside the card, closed shows "Position closed." + Realized P/L inside
   the card; the `quantity>0` gating and Realized-P/L visibility are unchanged.
   `npm run verify` green; Designer sign-off on the visual.

8. [x] **[UI] Move Positions to the last tab (both routes).** In BOTH
   `app/(dashboard)/research/[symbol]/page.tsx` (ALL_TABS, lines 47-54) and
   `app/(dashboard)/portfolio/[ticker]/page.tsx` (ALL_TABS, lines 23-30), move the
   `{ value: "transactions", label: "Positions" }` entry to the end of the array (after
   `news`). — **Acceptance:** on both routes, the tab order reads Overview · Technical ·
   Fundamental · Analysts · Intrinsic value · News & sentiment · Positions; the
   conditional omission still works when there are no transactions; `npm run verify` green.

### News & sentiment tab

9. [x] **[UI] Remove the top "Sentiment Analysis" card (portfolio route only).** In
   `app/(dashboard)/portfolio/[ticker]/page.tsx`, remove the `<SentimentScore ... />`
   render (line 340) and its now-unused import (line 15). Keep the `newsArticles` query
   and the `NewsFeed` render unchanged. Confirm no other consumer of `SentimentScore`
   remains (grep shows only this route); if the file becomes fully unused, it MAY be
   deleted, but that is optional cleanup — note it, don't force it. — **Acceptance:** the
   News & sentiment tab on `/portfolio/[ticker]` shows only the "NEWS & SENTIMENT" card
   (no top Sentiment Analysis box); `/research/[symbol]` is unchanged (it never rendered
   it); `npm run verify` green (no unused-import lint regression).

Task status markers: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

## Files to create or modify

- `components/analyst-ratings.tsx` — items 1, 2, (3)
- `lib/services/analyst-ratings.service.ts` — items 2, (3)
- `lib/services/analyst-ratings.service.test.ts` — items 2, (3) extractor tests
- `components/intrinsic-value.tsx` — items 4, (5), (6)
- `lib/services/intrinsic-value.service.ts` — items (5), (6)
- `lib/services/intrinsic-value.service.test.ts` (create if missing) — item (6) low/high derivation test
- `app/api/research/[symbol]/intrinsic-value/route.ts` — type passthrough if the result shape grows (items 5/6)
- `components/research/transactions-tab.tsx` — items 6, 7
- `app/(dashboard)/research/[symbol]/page.tsx` — item 8
- `app/(dashboard)/portfolio/[ticker]/page.tsx` — items 8, 9
- `components/sentiment-score.tsx` — item 9 (optional deletion only)
- `DESIGN.md` — item-6/item-5 spec updates (Designer stage owns these before coding items 5/6/7)
- `DECISIONS.md` — a new ADR only if OD-2 resolves to the flex-assumptions scenario model, or OD-1 resolves to a real FCF DCF (band/model definition is ADR-worthy). A relabel, a Low/High mapping, or the method-spread bear/bull default is NOT ADR-worthy.
- `TECH_DEBT.md` — update/close TD-DTL-REV depending on OD-3; add an item if OD-1/OD-2 defer the bigger model.

## Verification

`## Verify` in AGENT.md runs automatically (`npm run verify` — typecheck, lint, tests,
secret-scan). Beyond it, manual/Playwright checks:

- **Item 1:** open Analysts tab for a symbol with a Buy count > 0; the Buy bar is a
  solid, clearly visible green bar (not washed out). Check both light and dark themes.
- **Item 2:** open Analysts tab for ENGI.PA; LOW and HIGH show real figures if Yahoo
  returns them; confirm a mean-only symbol still shows `—`.
- **Items 4/5/6:** open Intrinsic tab; every visible assumption/scenario value is
  traceable to a real computed input (no permanent hardcoded `—` describing a
  non-existent model); Bear ≤ Base ≤ Bull when populated.
- **Item 7:** Positions stat block reads as the same card idiom as the Analysts/Intrinsic
  cards; no "Your position" text; held and closed states both correct — Designer verifies.
- **Item 8:** Positions is the last tab on both `/research/[symbol]` and
  `/portfolio/[ticker]`; still omitted for a never-transacted symbol.
- **Item 9:** `/portfolio/[ticker]` News tab has no top Sentiment Analysis box;
  `/research/[symbol]` News tab unchanged.

## Assumptions

- **A1 — Item 1 is a legibility bug, not a width-calc bug.** The count renders and the
  width math (`count/total*100`) is correct; the only defect is the `/70` opacity tint
  making the oklch-green bar near-invisible over the warm track. Verified against ADR-8's
  opacity-modifier behavior and DESIGN.md's solid-color band vocabulary. If, on the live
  app, the Buy bar is genuinely *zero-width* (not just faint), re-open as a width bug —
  but the evidence points to the tint.
- **A2 — Item 2's Low/High are present upstream for ENGI.PA.** Median (`targetMeanPrice`)
  is present, and Yahoo's `financialData` returns low/mean/high as a set; it is very
  likely low/high are present too. If a given symbol returns only the mean, the em-dash
  is then correct and the plan already handles it (null → `—`).
- **A3 — Item 9 is portfolio-route-only.** The research route never rendered
  `SentimentScore`; no change needed there.
- **A4 — No DB migration for items 2/3.** Low/High and revisions can ride the live
  formatted response without new `AnalystRating` columns; the tradeoff is they are absent
  on a 24h cache hit (the row returns without them). OD-3 decides whether that's
  acceptable or whether to add columns (a shared-DB migration, ADR-6 caution).

## Open decisions

**RESOLVED 2026-07-20 by owner — all three took the recommended option (no ADR warranted):**
- **OD-1 → (A) Honest relabel.** Drop the FCF margin / Terminal growth rows; show the model's real inputs (Earnings growth capped, Terminal P/E, Discount rate) and fix the "Revenue growth" mislabel. No new DCF model.
- **OD-2 → (A) Method spread.** Bear = min, Bull = max, Base = weighted average of the 5 already-computed valuation methods; truthful captions (Designer confirms "bear/bull" vs "valuation range" wording). No new scenario model.
- **OD-3 → include the plumbing now, non-persisted (no DB migration).** Map revisions through; earned empty state when the array is empty.

All nine items now proceed. Original decision text retained below for context.

These block the Coding agent for their specific items only (items 3, 5, 6, and the
choice within item 4). Items 1, 2, 7, 8, 9 proceed on plan approval regardless.

- **OD-1 — Intrinsic "Model assumptions": honest relabel vs. build a real FCF DCF.**
  FCF margin and Terminal growth are not computed anywhere (DCF Lite is an EPS-multiple
  model). Two options:
  - **(A) Honest relabel (recommended, small, low-risk):** drop "FCF margin" and
    "Terminal growth"; show the assumptions the model *actually* uses — Earnings growth
    (capped), Terminal P/E, Discount rate — and, if wanted, a derived FCF margin from
    `fcfPerShare × shares / revenue` when those inputs exist. Also fixes the item-4
    mislabel. No new modeling, honest to the code.
  - **(B) Build a real FCF-perpetuity DCF** that genuinely produces FCF margin + terminal
    growth. Larger; changes the fair-value math; ADR-worthy (assumption values). DESIGN.md
    currently documents these as intended data-gap em-dashes, so (B) reverses a
    documented decision deliberately.
  Recommended: **(A).** Owner to confirm.

- **OD-2 — Bear/Bull: method-spread default vs. flex-assumptions scenario model.**
  - **(A) Method-spread (recommended, surfaces existing values, no new model):**
    Bear = min, Bull = max of the 5 already-computed method values; Base = weighted
    average. Truthful captions ("Lowest/Highest of N methods"). Not ADR-worthy.
  - **(B) Flex-assumptions scenario model:** vary growth/WACC/terminal ±a band to
    produce bear/bull. Bigger build; the band definition is ADR-worthy. DESIGN.md
    currently documents Bear/Bull as intended em-dashes, so (B) reverses that decision.
  Recommended: **(A).** Owner to confirm. (If (A), whether "min/max of methods" is a fair
  "bear/bull" framing or should be labelled "valuation range" is a wording call for the
  Designer.)

- **OD-3 — Analyst revisions (item 3): include the plumbing now, or defer?** The field is
  fetched but never returned. Plumbing it through is low-risk, but for ENGI.PA the
  rendered result is still likely an (earned) empty state. Include now (Task 3), or defer
  to a later pass and only reword the current hardcoded empty state? Also decides A4:
  persist revisions/low-high on `AnalystRating` (a shared-DB migration) or keep them
  non-persisted (absent on cache hits). Recommended: **include the plumbing now,
  non-persisted (no migration)** — the value is present on the fresh 24h fetch and simply
  absent on cache hits, which is acceptable for a display-only enhancement and avoids a
  shared-DB migration.

## Notes for the Designer stage

The Designer stage runs after approval because items 7 (Positions card treatment) and 9
(News card removal) are visual, and items 5/6 add/change visible values in the Intrinsic
tab. Reference only existing DESIGN.md tokens/components.

- **Item 7 — Positions card + header treatment (the main visual task; DESIGN.md item-6
  update).** The owner wants the in-tab "Your position" block to read like the OTHER
  tabs' cards. The shared pattern those tabs use is **`HeadlineScoreCard`**
  (`components/research/headline-score-card.tsx`, DESIGN.md "Headline score card"):
  `rounded-lg border border-border bg-card px-7 pb-7 pt-6` + `border-t: 3px double
  var(--foreground)` editorial top rule + a header row (`flex items-center justify-between
  border-b border-line2 pb-4`: left `text-[11px] font-semibold uppercase
  tracking-[0.14em]` kicker, right `text-[10.5px] uppercase tracking-[0.1em] text-mut`
  meta). The Positions block is a *stat band*, not a scored headline, so it should NOT
  reuse `HeadlineScoreCard` wholesale (no 84px ScoreFigure/left-column). Instead spec a
  **card wrapper with the same header row idiom** wrapping the existing stat band:
  - Card chrome + editorial top rule identical to `HeadlineScoreCard`'s (tokens:
    `border-border`, `bg-card`, `border-double border-foreground`).
  - Header row: left kicker "POSITION" (or "YOUR POSITION" — Designer to choose the
    wording; the owner asked to remove the standalone "Your position" *heading*, and the
    coherent reading is to move that intent into the card's own header row like
    "ANALYST RATINGS"); optional right meta (e.g. nothing, or a currency note). Follows
    the `HeadlineScoreCard` header tokens exactly.
  - Body: the existing Shares held / Average cost / Market value / Unrealised P/L (+ 5th
    Realized P/L per `hasRealizedPL`) stat band, and the "Position closed." + Realized
    P/L closed state, moved inside the card. Keep cell kickers `text-[10.5px] uppercase
    tracking-[0.12em] text-mut`, values `font-serif text-[26px]`, signed cells
    `--up`/`--dn`, `border-l border-line2 pl-5` verticals — all pre-existing tokens.
  - This **supersedes** DESIGN.md item 6's "bare, top-ruled editorial band"
    (lines 804-900, from `plans/2026-07-19-positions-band-restyle.md`) and the prior
    standalone "Your position" kicker (lines 831-835). The Designer must update DESIGN.md
    item 6 to the card+header treatment and note the supersession explicitly (do not
    delete the history — mark it superseded).
  - The "none" defensive empty state (lines 871-879) is unchanged and out of scope.
  - The page-header market grid (Current price / Day range / 52-week range / Market cap)
    is unchanged (DESIGN.md lines 881-888) — the in-tab card is visually distinct from it
    by being the editorial-top-rule card idiom vs. the header's card-wrapped ruled grid.

- **Item 6 — no separate visual work.** Removing the standalone "Your position" kicker is
  folded into item 7's card-header treatment (the header row carries the title now).

- **Item 8 — tab reorder — no visual spec.** Order-only change; the tab-bar chrome (gap,
  padding, underline) is unchanged (DESIGN.md "Segmented tabs"). Note that Positions
  moving to last does not change the conditional-6-vs-7-tab rule.

- **Item 9 — News card removal — confirm the remaining card still reads correctly.** With
  the top "Sentiment Analysis" card gone, the News tab on `/portfolio/[ticker]` leads with
  the "Refresh news" button row then the `NewsFeed` "NEWS & SENTIMENT" `HeadlineScoreCard`
  (editorial top rule) + "Latest coverage" card. Confirm the `space-y-5` rhythm and the
  editorial top rule still read as a clean tab lead-in with nothing above them, matching
  the research route's News tab (which already renders `NewsFeed` alone). No token change
  expected; just verify the spacing/lead-in.

- **Items 5/6 (Intrinsic, if OD-1/OD-2 approve surfacing values)** — the scenario band
  (Bear/Base/Bull) and Model-assumptions rows already have DESIGN.md geometry
  (item 5, lines 795-803). If the method-spread default (OD-2 A) is chosen, the Designer
  should confirm whether "Bear/Bull" labels are honest for a min/max-of-methods range or
  should read "Low / Weighted / High" (a valuation range) — a wording call, no new token.
  If OD-1 A (honest relabel) is chosen, update DESIGN.md line 801-803's assumption list to
  the real inputs.
