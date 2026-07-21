# Plan: named investment-style presets for scoring weights
Date: 2026-07-21

## Problem

The scoring-weight system (ADR-20/21/22) lets a user hand-tune ten weights across
two independent groups — composite (`intrinsicValue`, `fundamental`, `technical`,
`sentiment`, `analyst`) and fundamental (`valuation`, `profitability`, `growth`,
`financial`, `dividend`) — on `app/(dashboard)/settings/page.tsx`. Reaching a
coherent, well-known allocation (a value tilt, a momentum tilt, an income tilt)
today means the user typing all five percentages per group from scratch and
making each group sum to 100 by hand. There is no starting point other than the
house default ("Reset to house defaults", which is the Balanced allocation).

Add named investment-style presets (Value, Deep Value/Contrarian, Quality/GARP,
Growth, Momentum, Sentiment/News-driven, Analyst Consensus, Dividend/Income,
Balanced) that populate a section's five weights in one click, so a user picks a
style rather than deriving numbers. The concrete preset values are already decided
(see `## Approach` → data). The composite group has all eight named styles (nine
entries including Balanced); the fundamental group has six (Momentum, Sentiment,
and Analyst Consensus are momentum-/flow-/consensus-driven with no meaningful
fundamental sub-tilt, so they define no fundamental group and are omitted there).

## Approach

### 1. Presets as a single source of truth, in whole-percent scale

Add a `SCORING_STYLE_PRESETS` constant to `lib/utils/scoring-weights.ts`, beside
`DEFAULT_SCORING_WEIGHTS`. **Scale decision: whole percents summing to 100 per
group, not fractions.** Rationale:
- The settings page and its API boundary already operate entirely in the
  whole-percent scale (ADR-22): the GET returns percents, the inputs are
  percents, `sumsTo100`/the Save gate check percents. A preset's job is to
  populate those percent inputs. Emitting fractions would force a
  `fractionsToPercents(...)` conversion at every apply site, re-introducing the
  scale-translation step ADR-22 deliberately confined to one boundary.
- The internal scoring scale stays fractions (`DEFAULT_SCORING_WEIGHTS`
  unchanged) — presets are UI/settings-layer data, exactly like the percent form
  the settings page already consumes. This keeps the ADR-22 invariant intact: the
  only place fractions↔percents convert is the settings service boundary; presets
  never touch the scoring consumers.

Shape (a preset is a display label plus, for each group it covers, a whole-percent
weight record):

```ts
export interface ScoringStylePreset {
  id: string;                          // stable key, e.g. "value"
  label: string;                       // e.g. "Value"
  blurb: string;                       // one short line, ≤ ~60 chars, for the UI
  composite?: Record<keyof CompositeWeights, number>;   // whole percents, sums to 100
  fundamental?: Record<keyof FundamentalWeights, number>; // whole percents, sums to 100
}

export const SCORING_STYLE_PRESETS: ScoringStylePreset[] = [ ... ];
```

Both groups are optional per preset so Momentum can carry only a composite tilt.
The settings section reads only the group that matches it (`preset.composite` in
the Composite section, `preset.fundamental` in the Fundamental section) and
ignores presets that do not define its group.

**Data** (whole percents; every group sums to exactly 100 — verified):

Composite (`intrinsicValue / fundamental / technical / sentiment / analyst`) — eight styles:
| id | label | int | fund | tech | sent | anal |
|----|-------|-----|------|------|------|------|
| `value` | Value | 40 | 35 | 5 | 5 | 15 |
| `deep-value` | Deep Value / Contrarian | 45 | 30 | 5 | 15 | 5 |
| `quality` | Quality (GARP) | 25 | 40 | 10 | 10 | 15 |
| `growth` | Growth | 10 | 30 | 20 | 20 | 20 |
| `momentum` | Momentum | 5 | 10 | 45 | 25 | 15 |
| `sentiment` | Sentiment / News-driven | 5 | 15 | 25 | 40 | 15 |
| `analyst` | Analyst Consensus | 15 | 20 | 10 | 15 | 40 |
| `income` | Dividend / Income | 20 | 30 | 5 | 10 | 35 |
| `balanced` | Balanced | 25 | 25 | 20 | 15 | 15 |

Fundamental (`valuation / profitability / growth / financial / dividend`) — six styles
(`momentum`, `sentiment`, `analyst` are composite-only and define no fundamental group):
| id | label | val | prof | grow | fin | div |
|----|-------|-----|------|------|-----|-----|
| `value` | Value | 45 | 25 | 5 | 20 | 5 |
| `deep-value` | Deep Value / Contrarian | 50 | 20 | 5 | 20 | 5 |
| `quality` | Quality (GARP) | 15 | 45 | 20 | 15 | 5 |
| `growth` | Growth | 5 | 20 | 55 | 15 | 5 |
| `income` | Dividend / Income | 20 | 25 | 5 | 20 | 30 |
| `balanced` | Balanced | 30 | 30 | 20 | 15 | 5 |

**Balanced must not duplicate the default numbers as literals.** Balanced equals
`DEFAULT_SCORING_WEIGHTS` by construction (composite 25/25/20/15/15, fundamental
30/30/20/15/5). Derive the Balanced entry from
`fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite)` /
`fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental)` (a module-level
computation, same call the settings page already makes for its Reset values),
NOT a second hand-typed `{25,25,20,15,15}`. This keeps one source of truth for the
house default and means a future default change flows into Balanced automatically.
A unit test asserts `balanced.composite` deep-equals
`fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite)` (and the fundamental
counterpart) to lock this.

The other seven presets are static whole-percent literals (they are curated style
allocations with no relationship to the default).

### 2. Applying a preset is purely client-side — populate the form, do not save

Applying a preset writes the preset's percents into the section's existing input
state (identical mechanism to the existing "Reset to house defaults" button, which
calls `setInputs(toInputs(defaultPercents))`). It does **not** issue a `PUT` and
does **not** auto-save. This is the lower-risk path and is mandatory here:
- No new API path, no new service function, no schema/migration change — the
  existing `PUT /api/settings/scoring-weights` + `saveWeights` already accept any
  100-summing whole-percent group, which every preset is.
- It preserves the explicit-save discipline the whole feature is built on
  (ADR-22 / DESIGN.md "Settings — scoring weights": auto-save is explicitly
  rejected; the user composes, then presses Save). Applying a preset makes the
  section dirty and (because every preset group sums to 100) immediately valid, so
  the existing `canSave = isValid && isDirty` gate enables Save with no special
  casing. The user reviews the populated values and presses the existing Save.
- Because presets are already 100-sum whole percents, they flow through the
  existing `computeGroupTotalState` → status-line/Save-gate logic unchanged. The
  status line reads "Total: 100% · valid" the instant a preset is applied.

### 3. UI affordance — per-section preset picker

Presets are applied **per section**, matching the existing per-section Reset/Save
structure (the two groups drive different scores and are tuned independently —
DESIGN.md is explicit that section actions do not touch the other section). Each
`ScoringWeightsSection` renders a preset control that lists only the presets which
define that section's group (so the Fundamental section shows five, omitting
Momentum). Selecting one calls `setInputs(toInputs(preset[group]))` for that
section.

Design/placement is the Designer's call in the design stage (this is a
UI-touching feature; the orchestrate pipeline runs a Designer stage before
coding). This plan constrains the Designer to existing DESIGN.md tokens/components
only (no new color/spacing/type-scale value — same rule the settings page already
follows) and records the following functional requirements the picker must meet;
the Designer chooses the concrete control (e.g. a labelled row of secondary
pills, or a `select`) and its exact chrome:
- Lives inside each Editorial card, above the Weight stepper rows (a starting
  point for tuning belongs before the fields it fills), below the group-total
  status line — Designer may refine.
- One entry per applicable preset, showing `label` (and optionally `blurb`).
- Applying is client-side populate-only (§2); it never auto-saves and never
  bypasses the Save gate.
- Reuses existing tokens/components; introduces no new named design token. If the
  Designer concludes a genuinely new component pattern is warranted, they add it
  to DESIGN.md as a named entry first (Designer-role rule), and this plan's
  "existing patterns only" default is superseded by that DESIGN.md addition.

### 4. What stays untouched

- `DEFAULT_SCORING_WEIGHTS`, `normalizeWeights`, `weightedCompositeTotal`,
  `weightedFundamentalTotal`, `fractionsToPercents`, `percentsToFractions`,
  `sumsTo100`, `weightsEqualDefaults` — all unchanged (the ADR-22 grep invariant
  and scale-invariance regression tests must stay green).
- The three scoring consumers (`components/overview.tsx`,
  `lib/services/fundamental-analysis.service.ts`,
  `lib/services/wishlist.service.ts`) — untouched; presets are settings-layer
  only.
- `app/api/settings/scoring-weights/route.ts`, `saveWeights`,
  `getWeightsForSettings` — untouched. A saved preset persists as ordinary
  percents; the backend cannot tell a preset from a hand-typed value, by design
  (no "which preset is active" state is stored — see Assumptions).
- `computeGroupTotalState` / `scoring-weights-settings-gate.ts` — untouched; a
  preset just seeds `inputs`, which this already handles.

## Tasks

1. [x] Add `ScoringStylePreset` type + `SCORING_STYLE_PRESETS` (whole-percent, nine
   composite / six fundamental entries; Balanced derived from
   `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`, not literal) to
   `lib/utils/scoring-weights.ts`. — Acceptance: `npm run verify` typecheck passes;
   a new `scoring-weights.test.ts` block asserts (a) every preset group sums to
   exactly 100, (b) each group has exactly the five expected keys, (c) all nine
   presets (`value`, `deep-value`, `quality`, `growth`, `momentum`, `sentiment`,
   `analyst`, `income`, `balanced`) define `composite`; `momentum`/`sentiment`/
   `analyst` define `composite` and NOT `fundamental`; the other six
   (`value`/`deep-value`/`quality`/`growth`/`income`/`balanced`) define
   `fundamental`, (d) `balanced.composite` deep-equals
   `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite)` and
   `balanced.fundamental` deep-equals `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental)`.
2. [x] Add a pure helper (co-located in `scoring-weights.ts` or the settings-gate
   module) `presetsForGroup(group: "composite" | "fundamental"): ScoringStylePreset[]`
   returning only presets that define that group, preserving array order. —
   Acceptance: unit test — `presetsForGroup("fundamental")` excludes `momentum`,
   `sentiment`, `analyst` and returns six in listed order; `presetsForGroup("composite")`
   returns all nine.
3. [x] Wire the per-section preset picker into `app/(dashboard)/settings/page.tsx`'s
   `ScoringWeightsSection` per the Designer's spec: render `presetsForGroup(group)`,
   and on select call `setInputs(toInputs(preset[group]!))`. Reuse existing
   `toInputs` + existing token classes only. — Acceptance: applying a preset in the
   running app populates all five fields, flips the status line to "Total: 100% ·
   valid", enables Save (dirty+valid); Save persists exactly those percents and the
   toast fires (manual/Playwright — see Verification). No `PUT` fires on apply,
   only on the subsequent Save click.
4. [x] Update docs: `DESIGN.md` "Settings — scoring weights" gets the preset-picker
   entry (Designer, during the design stage — reference existing tokens); a new ADR
   in `DECISIONS.md` (ADR-23, drafted below) records the preset-as-percent-data +
   client-side-populate decisions; `ARCHITECTURE.md`'s `scoring-weights.ts` Key-files
   row gains a mention of `SCORING_STYLE_PRESETS`. — Acceptance: docs reference only
   existing tokens; ADR cites `SCORING_STYLE_PRESETS`' file; grep invariant note in
   AGENT.md still holds (presets are percent data, not a second fraction weights
   definition — no `intrinsicValue:\s*0\.25` / `valuation:\s*0\.3` literal added).

Task status markers (Coding agent maintains): [ ] todo · [~] in progress · [x] done · [!] blocked

## Files to create or modify

- `lib/utils/scoring-weights.ts` — add `ScoringStylePreset`, `SCORING_STYLE_PRESETS`, `presetsForGroup` (modify).
- `lib/utils/scoring-weights.test.ts` — add preset test block (modify).
- `app/(dashboard)/settings/page.tsx` — per-section preset picker (modify).
- `DECISIONS.md` — add ADR-23 (modify; drafted below).
- `ARCHITECTURE.md` — mention presets in the `scoring-weights.ts` Key-files row (modify).
- `DESIGN.md` — preset-picker entry under "Settings — scoring weights" (Designer, modify).

No new files strictly required. If the picker becomes a reusable component, the
Coding/Designer stage may add `components/...` — flag it if so; not assumed here.

## Verification

`npm run verify` (AGENT.md `## Verify` block) covers typecheck + lint + the new
unit tests + secret scan. Beyond it, manual/Playwright UI checks (Task 3):
1. On `/settings`, in the Composite card, apply the "Value" preset → the five
   fields read 40 / 35 / 5 / 5 / 15 (in the page's field order:
   Technical 5 · Fundamental 35 · Analysts 15 · Intrinsic value 40 · News &
   sentiment 5), status line = "Total: 100% · valid", Save enabled.
2. Confirm no network request fires on apply (only on Save) — DevTools/Playwright
   network panel.
3. Press Save → `PUT` returns 200, "Weights saved" toast, values persist across a
   reload (GET returns them).
4. Fundamental card shows six presets (no Momentum, Sentiment, or Analyst
   Consensus); applying "Growth" reads 5 / 20 / 55 / 15 / 5. Composite card shows
   all nine.
5. Applying a preset then editing one field back below 100 flips the status line
   to `--dn` "must equal 100%" and disables Save — i.e. presets do not bypass the
   existing gate.

## Assumptions

- **The Dividend/Income composite numbers (20/30/5/10/35) are the owner's stated
  values but flagged by the owner as tunable** ("analyst-lean acceptable; owner
  may tune"). Encoded as given; changing them later is a one-line edit to
  `SCORING_STYLE_PRESETS` with no structural impact. Not a blocker.
- **No "active preset" state is persisted or displayed.** Applying a preset just
  fills the fields; nothing records that a section currently matches a preset, and
  the UI does not highlight "you are on Value". Presets are a starting point, not a
  saved mode. This matches the backend (which stores only percents, ADR-22) and
  avoids new schema/state. If the owner later wants "show which preset is active",
  that is a follow-up (a pure comparison of current percents against each preset,
  no storage) — logged as a possible future refinement, not built now.
- **Presets replace, not blend.** Applying a preset overwrites all five of the
  section's fields; it does not merge with current values. This is the only
  sensible semantic for a named allocation and matches Reset's behaviour.
- **Momentum, Sentiment, and Analyst Consensus have no fundamental preset.** These
  three are momentum-/flow-/consensus-driven styles with no coherent fundamental
  sub-tilt, so they define `composite` only and the Fundamental section omits them
  (six fundamental presets vs. nine composite). The `deep-value` fundamental tilt
  (50/20/5/20/5) is a deeper-value variant of the `value` tilt.
- **Picker exact chrome is the Designer's decision** within the token/pattern
  constraints in §3 — this plan does not fix it to pills-vs-select. Not material
  to the data model or the client-side-populate approach, which are what the plan
  commits.

## Open decisions (if any)

None. The two decisions the task asked to settle are resolved in the plan:
(1) presets live as whole-percent data in `SCORING_STYLE_PRESETS` alongside
`DEFAULT_SCORING_WEIGHTS`; (2) applying is purely client-side form population (no
new API path); (3) Balanced is derived from `DEFAULT_SCORING_WEIGHTS` via
`fractionsToPercents`, not duplicated.
