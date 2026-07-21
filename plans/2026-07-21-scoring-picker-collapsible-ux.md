# Plan: Collapsible style-preset picker + scoring-weights card layout polish
Date: 2026-07-21

## Problem

On `/settings`, the scoring-weights card renders the "Start from a style" preset
picker as an always-visible list of full-width label+description rows — nine rows
on the Composite section, six on the Fundamental section
(`app/(dashboard)/settings/page.tsx:224-241`, `presetsForGroup(group).map(...)`).
This list is tall: it dominates each Editorial card and pushes the actual Weight
stepper input fields — the thing most users came to edit — below the fold. The
owner reviewed the shipped Composite card and decided:

- **Primary problem:** the picker is too big and buries the weight inputs.
- **Primary fix:** make the picker a **collapsible section, closed by default**.
  A user who wants a preset opens the disclosure; everyone else sees the weight
  inputs immediately.

Two lower-priority polish items were flagged as real-but-secondary (see Tasks 2–3).

This is purely a layout / disclosure / (possibly) ordering change. The preset
weight VALUES, the presets themselves (ADR-23/ADR-24), the "no persisted
active-preset state" decision, the scoring math, the API, the DB, and the retuned
blurbs are all **untouched**.

## Approach

### Primary — collapsible picker (Task 1)

Wrap the existing preset-picker block (the "Start from a style" label + the
bordered hairline-divided list of `<button>` option rows) in a native-disclosure
collapse, **closed by default**, implemented once inside the shared
`ScoringWeightsSection` component so it applies to **both** the Composite and
Fundamental sections automatically.

**Functional requirements the implementation must satisfy (the Designer owns the
exact chrome; these are the invariants):**

1. **Collapsed by default.** On first render of each section the picker is closed;
   only its section header/trigger is visible (e.g. "Start from a style" with a
   chevron affordance and optionally a one-line hint). The five Weight stepper
   fields therefore sit immediately below the status line, no longer pushed down
   by a 9/6-row list.
2. **Native-disclosure, keyboard-accessible pattern.** Use either a
   `<details>/<summary>` element or an accessible button-controlled collapse
   (`<button aria-expanded aria-controls>` toggling a region). The trigger must be
   Tab-reachable, toggle on Enter/Space, and expose expanded/collapsed state to
   assistive tech (native `<summary>` gives this for free; a button-controlled
   collapse needs `aria-expanded`). No `<div onClick>` toggles.
3. **The existing option rows are unchanged when expanded.** When opened, the
   picker shows the exact existing label + always-visible `blurb` rows
   (`presetsForGroup(group)`), with their current classes, hover (`--fill`),
   focus-visible inset ring, and populate-only behavior. Do **not** restyle the
   rows themselves in this plan beyond what the disclosure wrapper requires.
4. **Populate-only click behavior preserved exactly.** Each row still calls
   `setInputs(toInputs(preset[group]!))` for its own section — no `PUT`, no
   persisted selection, no "active preset" highlight (ADR-23/ADR-24, DESIGN.md
   "Style preset picker" → States → "No 'selected'/active-preset visual state,
   ever"). Clicking a row inside the disclosure must NOT be swallowed by the
   disclosure toggle: verify a row click both applies the preset AND does not
   toggle the picker closed unexpectedly (a `<summary>` only toggles on the
   summary element itself, so rows inside the `<details>` body are safe; a
   button-controlled collapse likewise only toggles from its own trigger).
5. **Existing-token constraint.** Everything stays on existing DESIGN.md tokens —
   no new color, spacing, or type-scale value. The chevron/disclosure affordance,
   the trigger's exact type scale, and any one-line collapsed hint copy are the
   **Designer's** call in the design stage; this plan constrains them to existing
   tokens and the functional requirements above. `lucide-react` is already a
   dependency (ARCHITECTURE.md) if a chevron icon is wanted.
6. **Whether the picker stays open after a row click is a Designer decision**,
   bounded by these requirements. Two reasonable options: (a) leave it open (the
   user may want to try another preset or read the fields it just populated), or
   (b) auto-collapse after apply (returns focus to the compact card). Default to
   (a) leave-open unless the Designer specifies otherwise — it is the lower-risk,
   less-surprising behavior and needs no extra state wiring for a `<details>`. If
   the Designer picks auto-collapse, that becomes a stated design-spec item, not a
   silent implementation choice.

**Implementation shape (guidance, not a mandate — Coding agent confirms against
the Designer's spec):** the current block at `page.tsx:224-241` becomes the body
of a disclosure. A `<details>` with a `<summary>` "Start from a style" trigger is
the lowest-wiring option and gives collapsed-by-default (no `open` attribute),
native keyboard support, and native `aria-expanded`-equivalent semantics for
free; the chevron rotates via a CSS `[&[open]>summary_...]` selector or a
`group-open:` Tailwind variant. A button-controlled `useState(false)` collapse is
the alternative if the Designer wants a trigger that is not a `<summary>` (e.g.
to match a specific hover/focus treatment) — either satisfies the requirements.

### Secondary — polish (Tasks 2–3, lower priority)

**Task 2 — status-line / actions placement.** Consider whether the live "Total:
X% · valid/invalid" status line (`page.tsx:215-222`) reads better positioned
closer to the input fields it validates, and whether the Reset/Save actions row
placement relative to the inputs is optimal. Currently the status line sits
directly under the header row (above the picker + fields) per DESIGN.md item 2.
This is minor and bounded to existing tokens; the Designer owns the exact
treatment. **Constraint:** do not change the status-line's meaning, copy, states
(`--mut` valid / `--dn` invalid), or the `sumsTo100` gate — only its position
within the card if the Designer specifies a move. If the Designer concludes the
current placement is already correct, this task closes as "no change, confirmed."

**Task 3 — composite input field order.** See `## Open decisions` — the current
order is a deliberate, documented DESIGN.md invariant, so this task is **gated on
an owner/Designer decision** and must not be actioned blindly. It is included as a
task only so it is tracked; its acceptance is "decision recorded and applied, or
explicitly deferred." It touches only presentational field order, never the
persisted key mapping (see Open decisions for why that is safe).

## Tasks

1. [ ] **Collapsible preset picker (PRIMARY), shared component, closed by
   default, both sections.** Wrap the "Start from a style" label + option-row list
   in `ScoringWeightsSection` (`page.tsx:224-241`) in a native-disclosure collapse,
   closed by default, per the six functional requirements in Approach → Primary.
   Update `app/(dashboard)/settings/loading.tsx` so its skeleton reflects the
   collapsed default (a compact trigger row, not the 3-row expanded list stack it
   currently renders at `loading.tsx:40-50`) — the skeleton must match what the
   page shows on first paint (collapsed), or it will flash from a tall skeleton to
   a short card.
   — Acceptance: on `/settings`, both cards render with the preset picker
   collapsed on first load; the five Weight stepper fields are visible without
   scrolling past a 9/6-row list. Expanding the Composite picker (click or
   keyboard Enter/Space on the trigger) reveals all nine option rows; clicking a
   row (e.g. "Deep Value / Contrarian") populates 55/30/0/0/15 into
   Intrinsic/Fundamental/Technical/Sentiment/Analyst and the status line reads
   "Total: 100% · valid", with **no** `PUT /api/settings/scoring-weights` request
   fired (verify via devtools/Playwright network) until Save is pressed. The
   trigger exposes expanded/collapsed state to assistive tech (`<summary>` native,
   or `aria-expanded` on a button trigger). Repeat spot-check on the Fundamental
   card (six rows). `npm run verify` green.

2. [ ] **Status-line / actions placement review (SECONDARY, minor).** Apply the
   Designer's decision on whether the status line and/or Reset+Save actions row
   move relative to the input fields; if the Designer confirms the current
   placement, close as no-op with that confirmation recorded in the design spec.
   Meaning, copy, states, and the `sumsTo100`/dirty Save gate are unchanged either
   way.
   — Acceptance: card layout matches the Designer's final spec; status-line copy
   ("Total: X% · valid" / "Total: X% · must equal 100%") and its `--mut`/`--dn`
   state coloring are byte-identical to today; Save still enables only on
   `sumsTo100 && dirty`. `npm run verify` green.

3. [ ] **Composite input field order (SECONDARY, GATED — see Open decisions).**
   Only if the owner/Designer decides to reorder: change the order of
   `COMPOSITE_FIELDS` (`page.tsx:38-44`) — a presentational array reorder only.
   The `key` values (`technical`/`fundamental`/`analyst`/`intrinsicValue`/
   `sentiment`) and their binding to `inputs[f.key]` / `toNumbers` are unchanged,
   so no persisted key mapping is touched (see Open decisions for the safety
   argument). If the Designer also reorders the Overview `SubscoreBand` to keep
   the two consistent, that is a separate, larger change out of THIS plan's scope
   and must be split into its own plan. If the decision is "keep current order,"
   this task closes as deferred with no code change.
   — Acceptance: if actioned, the Composite section's five fields render in the
   agreed order, each still bound to its correct `key` (typing in the field
   labeled "Intrinsic value" still updates the `intrinsicValue` weight — verify by
   saving and reloading), and `computeGroupTotalState` still sums the same five
   keys. `npm run verify` green. If deferred, no code change and the decision is
   recorded here.

[Task status markers — the Coding agent maintains these in this file as it works:]
[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `app/(dashboard)/settings/page.tsx` — wrap the preset-picker block in the
  `ScoringWeightsSection` component in a collapsed-by-default disclosure (Task 1);
  possibly reposition the status line / actions row (Task 2, if the Designer moves
  them); possibly reorder `COMPOSITE_FIELDS` (Task 3, only if the owner approves).
- `app/(dashboard)/settings/loading.tsx` — update the skeleton's preset-picker
  region to mirror the collapsed default (Task 1), and mirror any Task 2 layout
  move so the skeleton matches first paint.
- `DESIGN.md` — the Designer updates the "Style preset picker (Settings — scoring
  weights)" component entry and the "Settings — scoring weights" UX flow to
  describe the collapsible/closed-by-default treatment and the disclosure
  affordance chrome (and any Task 2 placement change). **The Planner does not
  pre-write these; the Designer owns the visual spec.** This plan only constrains
  it to existing tokens + the functional requirements above.
- `DECISIONS.md` — a new ADR for the collapse decision (see below; the Planner
  adds the ADR-25 stub as `proposed`, the Coding agent flips it to `accepted` with
  file:line evidence on implementation).

## Verification

`npm run verify` (the AGENT.md `## Verify` block: typecheck + lint + vitest +
secret scan) runs automatically and gates every task. Beyond it, these are the
manual/UI checks the Coding agent (and later the Reviewer/Designer) should run
against the running dev server (the a11y + populate-only-preserved behavior is the
crux of Task 1 and is not covered by the existing pure unit tests — the settings
page's logic lives in `scoring-weights-settings-gate.ts`, which this plan does not
touch, so no new unit tests are strictly required, but the interaction below must
be verified live):

1. **Collapsed by default:** load `/settings`; both the Composite and Fundamental
   pickers are closed; the Weight stepper fields are visible without scrolling past
   the option list.
2. **Keyboard a11y:** Tab to each section's picker trigger; Enter/Space expands
   and collapses it; expanded state is announced (native `<summary>`, or
   `aria-expanded` toggles on a button trigger); Tab order flows
   label/trigger → (when open) option rows → Weight stepper fields → actions row.
3. **Populate-only preserved:** with the picker expanded, click an option row;
   confirm (a) the five fields populate with that preset's percents, (b) the status
   line flips to valid, (c) **no** `PUT /api/settings/scoring-weights` fires (network
   panel / Playwright request interception) until the existing Save button is
   pressed, and (d) no row is painted as "selected/active" afterward.
4. **Both sections:** repeat 1–3 on the Fundamental card (six rows, Momentum /
   Sentiment / Analyst Consensus absent).
5. **Skeleton parity:** throttle/hard-reload and confirm `loading.tsx` shows a
   collapsed-picker skeleton, not a tall expanded-list one (no visible
   tall→short jump on hydration).

## Assumptions

1. **The picker stays open after a row click by default** (Approach → Primary,
   req. 6), unless the Designer specifies auto-collapse. Leave-open is the
   lower-risk default and needs no extra state for a `<details>`.
2. **The collapsed trigger reuses the existing "Start from a style" kicker label
   copy** (`text-mut` kicker), optionally with a one-line hint and a chevron — all
   on existing tokens. Exact copy/chevron is the Designer's call; if the Designer
   wants different trigger copy, that supersedes this assumption.
3. **No new tests are required for Task 1** because the extracted, tested logic
   (`scoring-weights-settings-gate.ts` — running total, validity, Save gate) is
   untouched by a disclosure wrapper, and this repo has no `@testing-library/react`
   seam for component-interaction tests (AGENT.md, ADR-22). The disclosure behavior
   is verified live per Verification. If the Coding agent extracts any new pure
   helper while implementing, it adds a unit test for it per the standard Testing
   guidance.
4. **Task 1 alone fully addresses the owner's PRIMARY problem** (picker too big,
   inputs buried). Tasks 2–3 are polish and can land in the same PR or be split
   without affecting Task 1's completeness.

## Open decisions

**OD-1 — Composite input field order (blocks Task 3 only; does NOT block Task 1
or the plan overall).** The owner's secondary note asked to investigate the
composite input order, suggesting Intrinsic value (often the largest weight) is
buried bottom-right. **Investigation result:** the current order — Technical,
Fundamental, Analysts, Intrinsic value, News & sentiment (`page.tsx:38-44`,
`COMPOSITE_FIELDS`) — is **not accidental**. It exactly matches the Overview tab's
`SubscoreBand` column order (`components/overview.tsx:227-231`), and DESIGN.md item
4 (Settings — scoring weights UX flow) makes this an explicit, deliberate
invariant: *"matching the Overview tab's `SubscoreBand` column order exactly, so
the settings page and the score card it drives read as the same list in the same
order."* So reordering the settings inputs in isolation would **break a documented
consistency decision** — the settings card and the score card it configures would
no longer read as the same list.

Two coherent options, and this needs an owner/Designer call before Task 3 is
actioned:

- **Option A — keep the current order (recommended default).** Preserve the
  documented settings↔SubscoreBand consistency. The owner's "Intrinsic buried
  bottom-right" observation is real but is a property of the 2-column grid layout
  (`intrinsicValue` is the 4th of 5 fields, landing bottom-left/right depending on
  wrap), not of a wrong conceptual order. Close Task 3 as deferred, no code change.
- **Option B — reorder BOTH the settings inputs AND the Overview `SubscoreBand`
  together** to a new shared order (e.g. by conceptual priority /
  largest-default-weight-first: Intrinsic value, Fundamental, Technical, Analysts,
  News & sentiment). This keeps the two consistent but is a larger change touching
  a research-detail component and its shared primitive — **out of scope for this
  layout/disclosure plan** and should be its own plan if chosen.

**Reordering the settings inputs alone (breaking the invariant) is not
recommended** and should only be done if the owner explicitly accepts the
inconsistency. **Persisted-key safety, either way:** `COMPOSITE_FIELDS` is a
render-order array of `{key, label}`; each input binds to `inputs[f.key]` and
saves via `toNumbers(inputs)` keyed by `key`, and the PUT body is `{ [group]:
toNumbers(inputs) }` — an object keyed by dimension name, order-independent. So a
pure array reorder touches **no** persisted key mapping and carries no data risk
— the risk is purely the UX-consistency one above, not a correctness one.

This plan proceeds with **Task 1 (the primary fix) regardless of OD-1**. OD-1 only
gates the optional Task 3.

## Proposed ADR (Planner adds as `proposed`; Coding agent finalizes with evidence)

## ADR-25 — Style-preset picker is a collapsed-by-default disclosure; weight inputs sit above the fold
- **Decision:** the "Start from a style" preset picker in each `ScoringWeightsSection`
  (Composite and Fundamental) is wrapped in a native-disclosure collapse that is
  **closed by default**, so the five Weight stepper fields are visible on first
  render instead of being pushed below a nine/six-row always-visible option list.
  The collapse is a native-disclosure pattern (`<details>/<summary>` or a
  button-controlled `aria-expanded` region) — keyboard-accessible and
  screen-reader-legible. Applying a preset from an expanded row is **unchanged**:
  still `setInputs(toInputs(preset[group]!))`, populate-only, no `PUT`, and **no
  persisted or rendered "active preset" state** (ADR-23/ADR-24 preserved — the
  collapse sidesteps the earlier active-highlight tension by hiding the list, not
  by adding selection state).
- **Evidence:** [Coding agent fills: `app/(dashboard)/settings/page.tsx` (disclosure
  wrapper in `ScoringWeightsSection`), `app/(dashboard)/settings/loading.tsx`
  (collapsed-picker skeleton), DESIGN.md "Style preset picker" + "Settings — scoring
  weights" entries.]
- **Tradeoffs:** a preset now takes one extra click (open the disclosure) — accepted
  because the majority path is editing weights directly / using Reset, and the tall
  always-visible list was burying that primary path (the owner's stated problem).
  Rejected: shrinking the rows / truncating blurbs (fights ADR-24's "descriptions
  must be fully visible" decision, reintroducing the exact tooltip-invisibility
  problem that plan fixed); a scrollable fixed-height list (adds a nested scroll
  region inside a card, an idiom used nowhere else in this app). Collapsing keeps
  the full visible-description rows intact for users who open it while removing them
  from the default view for everyone else.
- **Status:** proposed
- **Confidence:** High — the change is layout-only; the populate-only mechanism,
  preset data, scoring math, API, and DB are provably untouched (no file outside
  the two settings files + DESIGN.md/DECISIONS.md is modified).
