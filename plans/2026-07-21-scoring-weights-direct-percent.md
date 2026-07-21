# Plan: Scoring weights — direct percentages that must sum to 100%
Date: 2026-07-21

## Problem

The configurable-scoring-weights feature (`plans/2026-07-20-configurable-scoring-weights.md`,
ADR-20/21, PR #22 — not yet merged) ships an **auto-normalize** UX: the user types
arbitrary relative numbers per dimension, the app normalizes each group to sum-to-1
at scoring time, and a live "normalized %" ruled band shows the resulting split. The
owner finds this indirect: "the user fills in the values and watches the resulting
normalized % in order to see the impact." He wants the user to type the **actual
percentages** directly — whole percents per dimension that must **sum to exactly
100%**, validated (no silent normalization; the % you type is the weight). This
supersedes OD-4 (auto-normalize) from the prior plan.

This is a **UX + validation change, not a scoring-behaviour change.** The scoring
result for any given effective weighting must be byte-identical to today.

## Approach

### The load-bearing insight: the scoring math is scale-invariant, so it does not change

`normalizeWeights` (`lib/utils/scoring-weights.ts`) divides each weight by its group
sum. `weightedFundamentalTotal` divides by the weight sum. Both are therefore
**invariant to the scale** of the stored numbers: a group stored as fractions
`{0.25, 0.25, 0.20, 0.15, 0.15}`, as percentages `{25, 25, 20, 15, 15}`, or as any
other proportional set all normalize to the identical fractions summing to 1.0, and
so produce the identical scores. Consequences:

- **Every scoring consumer stays unchanged.** `components/overview.tsx`,
  `lib/services/fundamental-analysis.service.ts`, and `lib/services/wishlist.service.ts`
  all pipe stored weights through `normalizeCompositeWeights`/`normalizeFundamentalWeights`
  before use. Whatever scale we store, they re-normalize to fractions. No change to the
  composite recompute, the server fundamental reweight, or the wishlist composite.
- **`normalizeWeights` / `weightedCompositeTotal` / `weightedFundamentalTotal` stay
  unchanged.** They already do the right thing for percentage inputs (dividing 25/25/20/15/15
  by 100 yields the same fractions the scoring already uses).
- **Existing raw rows score identically whether we present them raw or as normalized-%**
  — because the scoring path normalizes either one to the same fractions. This is what
  makes decision 3 (present legacy rows as their normalized-%) zero-risk for scoring.

So the change is confined to three surfaces: (1) the **canonical stored/display scale**
becomes whole percentages, handled at the API boundary; (2) the **settings page** is
reworked to direct-percent inputs with a live group-total/validity indicator and
save-disabled-until-100; (3) the **API/service validation** enforces sum≈100 and
0–100 range.

### Canonical representation decision

- **Internal scoring representation stays fractions** (`DEFAULT_SCORING_WEIGHTS` keeps
  `0.25…` etc.). This is the safest choice: it leaves `normalizeWeights` and the two
  weighted-total functions, plus all three scoring consumers, provably unchanged, and
  keeps the ADR-20 backward-compat assertion (`DEFAULT_SCORING_WEIGHTS.composite ===
  {intrinsicValue:0.25,…}`) intact. `weightsEqualDefaults` also keeps comparing against
  the fraction defaults on the scoring side.
- **The settings UI and the API present/accept whole percentages** (0–100 summing to
  100). Conversion happens at exactly one boundary: `scoring-preferences.service.ts`.
  Two new pure helpers in `scoring-weights.ts`:
  - `fractionsToPercents(weights)` — multiply each by 100 and **round to whole percents,
    then repair rounding drift** so the returned group sums to exactly 100 (largest-
    remainder / "give the leftover to the biggest bucket" — needed because e.g. three
    thirds round to 33/33/33 = 99). Defaults ×100 are already clean whole numbers summing
    to 100, so this is a no-op for defaults; it only matters for arbitrary legacy raw rows.
  - `percentsToFractions(percents)` — divide each by 100. Used when a caller wants the
    fraction form directly (not strictly required by the scoring path, which already
    normalizes percents to fractions, but useful and tested for symmetry).
  - `sumsTo100(weights, epsilon = 0.01)` — validation predicate: `Math.abs(sum - 100) <= epsilon`.
    (Whole-percent inputs summing to 100 sum cleanly; the epsilon only guards FP dust.)

### GET — present stored weights as whole percents summing to 100 (decision 3)

`getWeights(userId)` currently returns the raw-but-defaulted fraction/number set. Change
it (or add a `getWeightsAsPercents` used by the route) so the **GET response the settings
page consumes is whole percents summing to 100 per group**:

1. Load the row, coalescing null columns / missing row to `DEFAULT_SCORING_WEIGHTS`
   (unchanged).
2. **Normalize each group to sum-to-1** (`normalizeCompositeWeights` /
   `normalizeFundamentalWeights` — reuses the existing, tested math), then
   `fractionsToPercents`. This converts BOTH new percentage rows AND legacy raw rows to
   a valid whole-percent split summing to 100, uniformly — a legacy user opening Settings
   sees a valid 100-sum split matching their current (unchanged) scores, no surprise.

Because normalize-then-×100 is exactly what the scoring path already does to the same
stored numbers, the presented % split is the true weighting in effect — the settings
page and the scores agree.

Note: the scoring consumers keep calling `getWeights` (fraction/number form) — do NOT
route their reads through the percent form. Keep the scoring read path returning the
raw-coalesced numbers and add a separate percent-shaped accessor for the settings route,
OR have `getWeights` return percents and update the three scoring consumers to normalize
percents (they already normalize, so this is safe) — **chosen: keep `getWeights`
returning the raw-coalesced numbers unchanged (scoring consumers untouched, lowest risk)
and add `getWeightsForSettings(userId)` returning the percent form.** Documented in
Assumptions.

### PUT — validate sum≈100 and 0–100 range, store percents

`saveWeights` currently accepts any non-negative finite number and stores it raw. New
contract:

- Each supplied group must have **every value a finite number in `[0, 100]`** and the
  group must **sum to 100 within epsilon 0.01** (`sumsTo100`). Violations throw
  `InvalidScoringWeightsError` → the route returns 400. (Reject negative, >100,
  non-finite, and sum≠100.)
- A partial group (only some keys supplied) is not meaningful under sum-to-100 (you
  cannot validate the total). The settings page always PUTs a complete group of 5, so
  **require all five keys present** for any group supplied; a group with a missing key
  is a 400. (The old partial-merge behaviour is dropped — it only made sense under
  arbitrary relative weights.)
- **Store the percents as given** (0–100) in the same `Float` columns. No schema/migration
  change — the columns are generic `Float`; only the meaning/scale of the stored number
  changes, in code. Confirm: no new migration.

### Backward-compat / correctness invariants preserved

- A user with **no prefs row** still scores byte-identically: `getWeights` still coalesces
  to `DEFAULT_SCORING_WEIGHTS` (fractions), scoring path unchanged. The settings page shows
  25/25/20/15/15 (defaults ×100) because `getWeightsForSettings` normalizes-then-×100.
- **Single source of truth preserved** — still exactly one scoring definition in
  `lib/utils/scoring-weights.ts`. The new helpers are conversions/validation, not a second
  weights definition. The AGENT.md grep invariant (`intrinsicValue:\s*0\.25` etc. only in
  scoring-weights.ts) must still hold.
- **Scoring result unchanged for any effective weighting** — guaranteed by scale-invariance
  of `normalizeWeights`; asserted by tests below.

## Tasks

1. [x] **Add pure conversion + validation helpers to `lib/utils/scoring-weights.ts`.**
   Add `fractionsToPercents<K>(weights)` (×100, round to whole, largest-remainder repair
   so the result sums to exactly 100), `percentsToFractions<K>(percents)` (÷100), and
   `sumsTo100<K>(weights, epsilon = 0.01)`. `DEFAULT_SCORING_WEIGHTS` stays fractions;
   do NOT touch `normalizeWeights`/`weightedCompositeTotal`/`weightedFundamentalTotal`/
   `weightsEqualDefaults`. — Acceptance: `npx vitest run lib/utils/scoring-weights.test.ts`
   passes with new cases: `fractionsToPercents(DEFAULT.composite)` === `{25,25,20,15,15}`
   summing to 100; `fractionsToPercents(DEFAULT.fundamental)` === `{30,30,20,15,5}` summing
   to 100; a drift case (e.g. equal thirds `{1/3,1/3,1/3}`) returns whole percents summing
   to exactly 100 (largest-remainder repair); `percentsToFractions({25,25,20,15,15})`
   normalizes to the DEFAULT fractions; `sumsTo100` true for `{25,25,20,15,15}`, true at
   `100.005` (within epsilon), false at `94`, false at `101`.

2. [x] **Scale-invariance regression test (proves scoring is unchanged).** Add a test
   asserting `weightedCompositeTotal(scores, normalizeCompositeWeights(percentGroup))`
   equals `weightedCompositeTotal(scores, normalizeCompositeWeights(fractionGroup))` for
   the same proportions (e.g. `{25,25,20,15,15}` vs `{0.25,0.25,0.20,0.15,0.15}`), and the
   same for `weightedFundamentalTotal`. Also assert an arbitrary legacy raw row (e.g.
   `{2,2,1.6,1.2,1.2}`) and its `fractionsToPercents(normalize(...))` presentation produce
   the identical composite. — Acceptance: new test file section passes; demonstrates the
   percent split and the raw row score identically.

3. [x] **`scoring-preferences.service.ts` — percent-form accessor + sum-to-100 validation.**
   Add `getWeightsForSettings(userId)`: load row → coalesce to defaults (existing `getWeights`
   internals) → `normalizeCompositeWeights`/`normalizeFundamentalWeights` → `fractionsToPercents`
   per group; returns `{composite, fundamental}` as whole percents summing to 100. Keep
   `getWeights` (raw-coalesced numbers) unchanged for the scoring consumers. Rework
   `saveWeights` validation: for each supplied group, require all five keys present, each a
   finite number in `[0,100]`, and `sumsTo100(group)`; otherwise throw
   `InvalidScoringWeightsError`. Store the percents in the same columns (upsert unchanged in
   shape). — Acceptance: `npx vitest run lib/services/scoring-preferences.service.test.ts`
   passes with updated/added cases: `getWeightsForSettings` for a missing row returns
   defaults-as-percents summing to 100; for a legacy raw row returns its normalized-%
   summing to 100; `saveWeights` rejects a group summing to 94 (400-class error), rejects a
   value of `-1`, rejects `101`, rejects a group missing a key, accepts `{25,25,20,15,15}`.

4. [x] **API route `app/api/settings/scoring-weights/route.ts` — GET returns percents.**
   GET calls `getWeightsForSettings(auth.userId)` (percent form). PUT unchanged in shape
   (still delegates to `saveWeights`, still maps `InvalidScoringWeightsError` → 400) but now
   the service enforces sum-to-100. — Acceptance: `npx vitest run app/api/settings/scoring-weights/route.test.ts`
   passes with: GET returns a body whose groups sum to 100; PUT with a group summing to 94
   returns 400; PUT with a valid 100-sum group returns 200 and the saved (percent) body.

5. [x] **Settings page rework — direct-percent inputs, live group total, save-gated-on-100.**
   In `app/(dashboard)/settings/page.tsx`: inputs are whole percents (seed from the GET
   percent response; `toInputs`/`toNumbers` unchanged in mechanism, now carrying percents).
   **Remove the "normalized %" readout band** (the 28px-serif normalized figures + "Sums to
   100% after normalization." caption) as the primary feedback. **Replace it with a live
   GROUP TOTAL indicator** computed as the running sum of the section's five inputs, shown as
   e.g. "Total: 94% / 100%", valid (neutral/settled) at 100 within epsilon and warning-toned
   otherwise (exact treatment is the Designer's — see Notes for the Designer stage). **Disable
   Save until the group sums to 100** (within epsilon) AND is dirty (keep the existing dirty
   check). Reset-to-defaults sets 25/25/20/15/15 (composite) / 30/30/20/15/5 (fundamental) —
   `fractionsToPercents(defaults)`; these already total 100. Keep the per-section save (PUT
   one group), the toast, and the `["scoring-weights"]` invalidation. — Acceptance: manual
   (see Verification): typing values that sum to <100 or >100 disables Save and shows the
   total as invalid; at exactly 100 Save enables (if dirty); Reset restores a 100-sum default
   split; save succeeds and Overview/Fundamental scores reflect the new weighting.

6. [x] **Settings page unit/interaction test.** Add a test (Vitest + Testing Library, matching
   the repo's existing component-test setup if present; otherwise a focused pure-helper test of
   the total/validity logic extracted into a testable function) covering: Save disabled when the
   group total ≠ 100, enabled at 100 (and dirty); the running total reflects the summed inputs;
   Reset yields a 100-sum split. If the page has no extractable seam, extract the
   total/validity computation into a small pure helper in `scoring-weights.ts`
   (`sumsTo100` already covers validity — test the summing + gating logic). — Acceptance:
   the new test passes under `npm run verify`.

7. [x] **Docs: supersede OD-4 in DECISIONS (ADR update), AGENT.md note, ARCHITECTURE.md line.**
   Update ADR-20 to reflect the new direct-percent + sum-to-100-validated model superseding
   auto-normalize (see "Proposed DECISIONS.md entries"). Update the AGENT.md "Configurable
   scoring weights" fragile-surface entry: stored form is now whole percents summing to 100;
   scoring math unchanged (scale-invariant); the settings route uses the percent accessor while
   scoring consumers use `getWeights` unchanged. Update the ARCHITECTURE.md `UserScoringPreferences`
   line ("raw values, normalized at scoring time" → "whole-percent values summing to 100 (validated),
   normalized at scoring time — scale-invariant so scoring is unchanged"). — Acceptance: docs
   reference the new model; the AGENT.md grep invariant still holds (`grep -rn "intrinsicValue:\s*0\.25\|valuation:\s*0\.3"`
   finds hits only in `lib/utils/scoring-weights.ts`).

## Files to create or modify

- `lib/utils/scoring-weights.ts` — add `fractionsToPercents`, `percentsToFractions`, `sumsTo100` (Task 1)
- `lib/utils/scoring-weights.test.ts` — new cases (Tasks 1, 2)
- `lib/services/scoring-preferences.service.ts` — `getWeightsForSettings`, sum-to-100 validation in `saveWeights` (Task 3)
- `lib/services/scoring-preferences.service.test.ts` — updated/new cases (Task 3)
- `app/api/settings/scoring-weights/route.ts` — GET uses percent accessor (Task 4)
- `app/api/settings/scoring-weights/route.test.ts` — updated/new cases (Task 4)
- `app/(dashboard)/settings/page.tsx` — direct-percent UX, live total, save-gated-on-100, remove normalized readout (Task 5)
- settings page test (Task 6 — location per repo's component-test convention; else pure-helper test)
- `DECISIONS.md` — ADR-20 superseding update (Task 7)
- `AGENT.md` — update the configurable-scoring-weights fragile-surface entry (Task 7)
- `ARCHITECTURE.md` — update the `UserScoringPreferences` data-model line (Task 7)
- `DESIGN.md` — the Designer stage updates the "Weight stepper" + "Settings — scoring weights" spec (NOT this plan; flagged below)

Explicitly NOT modified (scale-invariance): `components/overview.tsx`,
`components/fundamental-analysis.tsx`, `lib/services/fundamental-analysis.service.ts`,
`lib/services/wishlist.service.ts`, `app/api/market/fundamentals/[symbol]/route.ts`,
`prisma/schema.prisma`, `prisma/migrations/**`. Task 2's regression tests are the guard
proving these need no change.

## Verification

The `## Verify` block in AGENT.md runs automatically (`npm run verify`). Beyond it:

- **Manual, settings page (requires the owner-gated migration to be applied to exercise
  live GET/PUT — see Assumptions; applied 2026-07-21):** open `/settings`; each group loads showing whole
  percents summing to 100 ("Total: 100% / 100%", valid). Change one input so the group sums
  to 94 → Save disabled, total shows invalid. Change so it sums to 101 → Save disabled.
  Adjust to exactly 100 → Save enables (when dirty). Save → toast; open a research symbol's
  Overview and the Fundamental tab → composite/fundamental scores reflect the new weighting;
  the "Your weighting" meta-kicker shows (weights differ from defaults). Reset to house
  defaults → 25/25/20/15/15 (composite) / 30/30/20/15/5 (fundamental), Save enabled, saving
  restores default scores and clears the custom-weighting kicker.
- **Scoring-unchanged spot check:** for a user with default weights (or no row), a symbol's
  composite and fundamental scores are identical before and after this change (defaults
  expressed as 25% normalize to the same fractions).

## Assumptions

- **`getWeights` stays fraction/raw-form for scoring consumers; a new `getWeightsForSettings`
  returns the percent form for the settings route.** This is the lowest-risk split (scoring
  consumers untouched). The alternative (make `getWeights` return percents and update the
  three consumers) is safe under scale-invariance but touches more surface for no benefit.
- **`fractionsToPercents` uses whole-percent rounding with largest-remainder repair** so
  every presented/stored group sums to exactly 100 even for arbitrary legacy raw rows. Whole
  percents are the owner's stated scale (decision 2); this plan does not offer a decimal-percent
  mode.
- **Storage is percents (0–100).** No migration — same `Float` columns, only the number's scale
  changes in code. Since the migration for this table is still owner-gated and unapplied and the
  table is essentially unused, there are no real rows to worry about; legacy-raw handling exists
  for correctness/robustness, not because populated rows are expected.
- **The owner-gated migration (`20260720220007_user_scoring_preferences`) remains unapplied and
  is not applied by this plan.** Live GET/PUT and per-user reweight still require the owner's
  `prisma migrate deploy` (unchanged from the prior plan). All new code/tests are exercised via
  mocks, as before. This plan adds no new migration.
  **Update 2026-07-21: the owner has since run `prisma migrate deploy` — `prisma migrate status`
  confirms "Database schema is up to date!". Live GET/PUT and per-user reweight are now
  exercisable against the real database (see ADR-22 in DECISIONS.md and the Verification
  section's manual-check caveat above, which depended on this).**
- **Save is gated on `dirty && sumsTo100(group)`.** A pristine, already-100 group keeps Save
  disabled (nothing to save) — consistent with today's dirty-gate.
- **Per-section (per-group) validation and save are retained** — Composite and Fundamental are
  independent; each must independently sum to 100 to save that section.

## Open decisions (if any)

None — the three owner decisions are settled and baked in above.

## Notes for the Designer stage

This change alters the Settings — scoring weights surface, so the Designer stage runs before
coding. The prior `DESIGN.md` spec ("Weight stepper" + UX flows → "Settings — scoring weights",
around DESIGN.md:636 and :1180) is written for the auto-normalize model and **needs superseding**.
Specific points for the Designer:

- **Inputs are now direct whole percentages (0–100), not arbitrary relative weights.** The
  "Weight stepper" field pattern (label + `inputClass` text input, `inputMode="decimal"`) can
  stay as the control idiom, but its meaning changes: the number IS the percent. Consider whether
  a trailing "%" affordance or whole-number stepping (0–100) is wanted; stay within the existing
  Add-position field idiom (no native `<input type=number>` spinner, no new Slider primitive —
  the prior rejection of the Radix slider still stands).
- **Remove the live "normalized %" ruled band** (DESIGN.md:1222 "Live normalized-% band", the
  28px-serif per-column normalized figures + "Sums to 100% after normalization." caption). The
  owner explicitly dislikes the type-and-watch-normalized loop — this readout is the thing being
  removed. Replace it with a **live group-total / validity indicator**: a single running total per
  section, e.g. "Total: 94% · must equal 100%", that reads as valid at 100 and as a gentle warning
  otherwise.
- **Validity / invalid-total treatment must stay within the existing token system — no fourth
  accent.** A text total in `--mut` that shifts to `--dn` (the existing down/negative token) when
  the sum ≠ 100 likely suffices; at 100 it can settle to `--ink`/`--mut` (neutral). Do not
  introduce a new warning color. The `--amber` token exists if a distinct "attention, not error"
  tone is wanted, but a `--mut`→`--dn` text treatment is the lighter-touch default — Designer's call.
- **Save-disabled-until-100 state.** Save is disabled (existing `disabled:opacity-50` on the
  `bg-btnbg` pill) until the group sums to 100 (within epsilon) and is dirty. The primary signal is
  the running-total indicator turning valid; the disabled pill is secondary. Decide whether an inline
  helper line near Save restates the requirement when invalid.
- **Reset-to-defaults** now sets a 100-sum whole-percent split (25/25/20/15/15 composite;
  30/30/20/15/5 fundamental) — unchanged in behaviour, but the copy/caption should no longer mention
  "normalization."
- Reference existing DESIGN.md tokens (`--mut`, `--dn`, `--amber`, `--ink`, `--line2`, `bg-btnbg`,
  `text-btnfg`, `inputClass`). Update both the "Weight stepper" component entry and the "Settings —
  scoring weights" UX-flow section to supersede the normalized-% band with the group-total/validity
  model.
