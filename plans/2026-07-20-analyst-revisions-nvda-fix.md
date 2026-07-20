# Plan: Analyst "Recent revisions" empty for NVDA — cache-hit + missing 90-day filter fix

Date: 2026-07-20

## Problem

The owner opened the Analysts tab for **NVDA** and saw "No analyst revisions in
the last 90 days." NVDA is one of the most heavily analyst-covered stocks in the
market, so the empty state is almost certainly wrong. This is a follow-on bug on
code just built on this same branch/PR #19 (`plans/2026-07-19-research-tab-fixes.md`
Task 3 / OD-3), which plumbed Yahoo's `upgradeDowngradeHistory` through
`lib/services/analyst-ratings.service.ts`'s `extractRevisions` helper into a
`revisions` array rendered by `components/analyst-ratings.tsx`.

### Root cause — verified against live Yahoo data, not guessed

A throwaway probe (`scratch/`, gitignored) called the project's real
`safeQuoteSummary('NVDA', { modules: ['financialData','recommendationTrend','upgradeDowngradeHistory','earningsTrend'] })`
wrapper and inspected the raw shape. Findings:

- **NVDA genuinely HAS revisions upstream.** `upgradeDowngradeHistory.history` is
  an array of **982 entries**, of which **32 fall within the last 90 days**. So
  the empty state is a bug, not a genuine upstream absence.
- **No timestamp seconds/ms bug.** yahoo-finance2 v3 declares `epochGradeDate` as
  a `date-time` field (`node_modules/.../quoteSummary-iface.schema.js:3099-3102`,
  interface `epochGradeDate: Date` at `quoteSummary-iface.d.ts:846`) and the
  library's Zod layer coerces the raw UNIX-seconds epoch into a **JS `Date`
  object** before returning it. The probe confirmed each entry's `epochGradeDate`
  is `instanceof Date` and `new Date(x).toISOString()` yields correct 2026 dates.
  `extractRevisions`' `new Date(entry.epochGradeDate).toISOString()`
  (`analyst-ratings.service.ts:152`) is therefore correct.
- **Field path is correct.** The code reads `upgradeDowngradeHistory.history`
  (`analyst-ratings.service.ts:140`) — the probe confirmed that is exactly where
  the array lives (top-level keys: `['history','maxAge']`).
- **Module is requested and returned.** `upgradeDowngradeHistory` is in the
  `modules: [...]` list (`analyst-ratings.service.ts:69-76`); no validation drift
  on this call. All 982 entries pass the `firm && action && epochGradeDate` filter
  (`analyst-ratings.service.ts:145`).

So on a **fresh fetch**, `extractRevisions` returns 982 revisions correctly. The
owner is not seeing that path. **The operative root cause is candidate #5 — the
non-persisted-on-cache-hit gap (OD-3/A4):**

- **`formatCachedData` hardcodes `revisions: []`** (`analyst-ratings.service.ts:222`,
  and `targetLowPrice`/`targetHighPrice` to `null` at :220-221). The DB cache table
  `AnalystRating` (`prisma/schema.prisma:167-185`) has **no column** for revisions
  or low/high, so a 24h cache hit returns them empty even when the last fresh fetch
  had them. The existing test at `analyst-ratings.service.test.ts:151-171` even
  asserts this `[]`-on-cache-hit behavior as intended.
- NVDA was fetched-and-cached earlier in the OD-3 pipeline (counts/score persisted
  to `AnalystRating` within the 24h TTL). Every subsequent open of the Analysts tab
  for NVDA is a **cache hit** → `formatCachedData` → `revisions: []` → empty state.
  This is a designed-in gap (TECH_DEBT.md TD-DTL-REV2), surfacing as a user-visible
  bug the moment a heavily-covered symbol's row is warm.

### Secondary correctness bug found while root-causing

**There is NO 90-day filter anywhere.** `extractRevisions` returns *all* matching
history entries (982 for NVDA); the component's "last 90 days" wording
(`analyst-ratings.tsx:128,182`) and the card's implied scope are a **label with no
backing filter**. On a fresh fetch NVDA would render **982 rows** claiming to be
"the last 90 days" — a different bug in the opposite direction (over-full, mislabelled)
that the cache gap is currently masking. Fixing the cache gap without adding the
filter would replace "empty" with "982 mislabelled rows." Both must be fixed
together. (Probe: 32 of 982 entries are genuinely within 90 days.)

## Approach

Two fixes, both required; they interact (fixing one alone leaves the other visible).

**Fix A — surface revisions reliably across cache hits.** This is the material
decision, because the clean fix touches the shared dev/prod DB (ADR-6). See
`## Open decisions` OD-1. **Recommended default: persist revisions + low/high on
`AnalystRating` via an additive schema migration** (matching ADR-14's owner-signed-off
precedent), because it is the only fix that makes the fields reliable *and* keeps
the 24h cache's purpose (avoid a Yahoo round-trip per page load). A no-migration
fallback (secondary revisions-only fetch on cache hit) is specified as OD-1 Option B.

**Fix B — add the missing 90-day window filter** in `extractRevisions` (or a shared
pure helper), so the rendered set matches the "last 90 days" label. This is
unambiguous and proceeds regardless of OD-1. Boundary rule: keep entries with
`epochGradeDate` within the last 90 days inclusive of the boundary instant, exclude
future-dated entries. Cap to a sane max (e.g. most recent 25) as defence against a
symbol with dozens of revisions inside 90 days — order newest-first.

**Guardrails honoured:**
- Financial/data services stay pure-ish; the filter is a pure function, unit-tested
  directly (AGENT.md — keep calc/extraction side-effect-free).
- No `AnalystRating` migration unless OD-1 Option A is signed off by the owner
  (dev/prod share one DB, ADR-6; additive-only per ADR-14).
- `safeQuoteSummary` remains the sole `quoteSummary` chokepoint (ADR-15) — any
  secondary fetch (OD-1 Option B) routes through it.
- Component visual is unchanged (the "Recent revisions" card already exists) — this
  is a data/logic fix. **No Designer stage needed** (see note at end).

## Tasks

1. [x] **[BUG] Add the 90-day window filter to revision extraction.** In
   `lib/services/analyst-ratings.service.ts`, filter `extractRevisions`' output to
   entries whose `epochGradeDate` is within the last 90 days (inclusive of the
   boundary, exclude future-dated), sorted newest-first, capped to the 25 most
   recent. Extract the window/sort/cap as a pure helper (e.g.
   `filterRecentRevisions(revisions, now, windowDays, cap)` — take `now` as a
   param so it is deterministically testable) so it can be unit-tested without a
   Yahoo mock. — **Acceptance:** unit test feeds a realistic payload (Date-typed
   `epochGradeDate`, mix of recent + old + one future-dated) and asserts only the
   in-window entries survive, newest-first; **a revision dated exactly 90 days ago
   is included and one dated 91 days ago is excluded** (boundary test); a
   future-dated entry is excluded; the cap truncates a >25-entry in-window set to 25.
   `npm run verify` green.

2. [x] **[BUG — Fix A, per OD-1 resolution] Make revisions + low/high survive a
   cache hit.**
   - **If OD-1 = Option A (recommended, persist):** add `targetLowPrice`
     `Decimal?`, `targetHighPrice` `Decimal?`, and `revisions` `Json?` columns to
     `AnalystRating` (`prisma/schema.prisma`); generate the migration with
     `prisma migrate dev --create-only` and hold for owner `prisma migrate deploy`
     sign-off (ADR-14 protocol — additive `ALTER TABLE ADD COLUMN` only, no
     destructive statements). Populate all three in `saveToDatabase`
     (post-90-day-filter revisions serialized to JSON) and read them back in
     `formatCachedData` (deserialize `revisions`, coalesce absent → `null`/`[]`).
   - **If OD-1 = Option B (no migration):** in `fetchAnalystRatings`, on the cache-hit
     branch, additionally call `safeQuoteSummary(symbol, { modules:
     ['financialData','upgradeDowngradeHistory'] })` and merge the freshly-extracted
     (and 90-day-filtered) `revisions` + `targetLowPrice`/`targetHighPrice` onto the
     cached row before returning. Wrap in try/catch so a failed secondary fetch
     degrades to the current `[]`/`null` rather than throwing.
   — **Acceptance:** with NVDA's `AnalystRating` row warm (cache hit), the returned
   `revisions` array is non-empty and within-90-days (Option A: read from the JSON
   column; Option B: from the secondary fetch); a symbol with genuinely no upstream
   revisions still returns `[]`. Update the existing cache-hit test
   (`analyst-ratings.service.test.ts:151-171`) to reflect the chosen behavior
   (Option A: revisions/low/high now populated from the row; Option B: populated
   from the mocked secondary fetch). `npm run verify` green.

3. [x] **[DOC] Reconcile docs with the fix.** Update `TECH_DEBT.md` TD-DTL-REV2
   (Option A: mark Resolved with date + migration reference, matching ADR-14's
   Resolved style; Option B: narrow it to "low/high still non-persisted if only
   revisions were addressed," or Resolved if Option B covers all three). Add an ADR
   to `DECISIONS.md` **only if OD-1 = Option A** (a schema migration on the shared
   DB is ADR-worthy, mirroring ADR-14). Add/adjust the
   `analyst-ratings.service.ts` AGENT.md fragile-surface entry (currently line 40,
   which documents the non-persisted gap) to reflect the new reality. — **Acceptance:**
   no doc claims revisions are non-persisted if they now are; the AGENT.md entry and
   TD-DTL-REV2 match the shipped code; ADR added iff a migration shipped.

Task status markers: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

## Files to create or modify

- `lib/services/analyst-ratings.service.ts` — 90-day filter (Task 1); cache-hit
  fix (Task 2, both options touch `formatCachedData`; Option A also `saveToDatabase`,
  Option B also `fetchAnalystRatings` cache branch).
- `lib/services/analyst-ratings.service.test.ts` — new filter/boundary tests (Task 1);
  updated cache-hit test (Task 2).
- `prisma/schema.prisma` + `prisma/migrations/<new>/migration.sql` — **only if
  OD-1 = Option A** (additive columns; held for owner sign-off).
- `TECH_DEBT.md` — TD-DTL-REV2 update/close (Task 3).
- `DECISIONS.md` — new ADR **only if OD-1 = Option A** (Task 3).
- `AGENT.md` — fragile-surface entry (line ~40) update (Task 3).

`components/analyst-ratings.tsx` is **not** modified — the card, table, empty state,
and "last 90 days" label already exist and are correct once the data arrives filtered.

## Verification

`## Verify` in AGENT.md runs automatically (`npm run verify` — typecheck, lint,
tests, secret-scan). Beyond it:

- **Manual (the owner's report):** open the Analysts tab for **NVDA**. "Recent
  revisions" now shows a populated firm/grade-change/RAISED·HELD·LOWERED/date table
  of recent (≤90-day) revisions, not the empty state. Confirm a genuinely
  thin-coverage symbol (e.g. ENGI.PA) still shows the earned empty state.
- **Cache path specifically:** the fix must hold on a **cache hit** (the operative
  bug), not only a cold fetch. Verify by opening NVDA twice (the second load is the
  24h cache hit) — both must show revisions.
- **90-day scope:** the rendered rows are all within ~90 days (no ancient 2019-era
  revision leaking in from NVDA's 982-entry history), newest-first, count sane (≤25).

## Assumptions

- **A1 — The owner is hitting the cache path, not a cold fetch.** Strongly supported:
  the probe proved a cold fetch returns 982 entries; the only path that yields `[]`
  is `formatCachedData`, and NVDA's row is warm from the OD-3 pipeline. If, against
  expectation, the owner is somehow on a cold fetch and still sees empty, the 90-day
  filter (Task 1) is still the fix (a mislabel/over-full case), and Task 2 is a no-op
  for that path — so the plan is correct either way.
- **A2 — 90 days is the intended window.** The card copy and metaKicker already say
  "last 90 days"; the plan makes the code honour the existing label rather than
  inventing a new window. If the owner wants a different window (e.g. 6 months), it
  is a one-constant change to the helper.
- **A3 — 25-row cap is a reasonable default.** NVDA has 32 revisions within 90 days;
  an uncapped table is long and repetitive. If the owner wants all in-window rows,
  drop the cap — a one-line change; not a design blocker.

## Open decisions

- **OD-1 — RESOLVED 2026-07-20 by owner: Option A (persist via additive migration).**
  Add `targetLowPrice`/`targetHighPrice`/`revisions (Json)` columns to `AnalystRating`;
  populate in `saveToDatabase`, read in `formatCachedData`. Additive `ADD COLUMN` only,
  held for owner `prisma migrate deploy` sign-off (ADR-6/ADR-14 protocol). A new ADR is
  written. Task 2 proceeds on Option A; Task 1 (90-day filter) proceeds regardless.
  Original decision text retained below for context.

- **OD-1 (original — now resolved above) — How to make revisions/low/high survive the 24h cache hit.** This is the
  one material choice; it changes what gets built.
  - **(A) Persist on `AnalystRating` via an additive migration (recommended).**
    Add `targetLowPrice`/`targetHighPrice`/`revisions (Json)` columns; populate in
    `saveToDatabase`, read in `formatCachedData`. **Pro:** the only fix that keeps
    the 24h cache's purpose (no extra Yahoo call per hit) *and* makes the fields
    reliable; closes TD-DTL-REV2 cleanly. **Con:** a schema migration on the shared
    dev/prod DB — requires explicit owner `prisma migrate deploy` sign-off (ADR-6,
    ADR-14 precedent). Additive `ADD COLUMN` only, no destructive statements, so the
    risk profile matches ADR-14, which the owner already approved. **ADR-worthy** →
    a new ADR is written iff this is chosen.
  - **(B) Secondary revisions-only fetch on cache hit (no migration).** On a cache
    hit, additionally fetch just `['financialData','upgradeDowngradeHistory']` via
    `safeQuoteSummary` and merge fresh revisions/low/high onto the cached row.
    **Pro:** no DB change, no owner-signoff gate, ships immediately. **Con:** adds a
    Yahoo round-trip to every warm Analysts-tab load (partially defeating the cache
    for this one module) and keeps revisions non-persisted; TD-DTL-REV2 stays open
    (narrowed). Not ADR-worthy.
  - **Recommendation: (A).** It is the correct-shape fix, and ADR-14 already
    established the additive-migration-with-sign-off pattern for this exact codebase.
    If the owner prefers to avoid any migration right now, (B) is a clean fallback
    the Coding agent can take without further planning. **The owner must pick A or B
    before Task 2 is coded** (Task 1 is unblocked regardless).

## Notes for the orchestrator / Designer stage

**No Designer stage is required.** This is a pure data/logic fix — the "Recent
revisions" card, its table, tag vocabulary (RAISED/HELD/LOWERED), empty state, and
"last 90 days" label already exist in `components/analyst-ratings.tsx` and are not
touched. The only change is making the `revisions` array actually arrive (populated
and correctly windowed). Skip Designer; go Planner → (owner OD-1 decision) → Coding
agent → Reviewer.
