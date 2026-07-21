# Plan: Style-preset picker → compact name chips + hover/focus tooltip, shown inline (drop the collapse)
Date: 2026-07-21

## Problem

The "Start from a style" preset picker in `ScoringWeightsSection`
(`app/(dashboard)/settings/page.tsx`, both the Composite and Fundamental cards)
has been through three shapes on this branch chain:

- ADR-23: a compact row of label-only pills, blurb in a bare `title` tooltip.
- ADR-24: a bordered, hairline-divided list of full-width rows — each row a
  label line + its blurb as **always-visible** text — precisely to kill the
  `title`-tooltip's invisibility (invisible on touch, on scan, to most users).
- ADR-25 (PR #26, current branch head): that same always-visible row list,
  wrapped in a native `<details>/<summary>` disclosure, **collapsed by
  default**, because the nine/six-row list dominated the card and pushed the
  five Weight stepper fields below the fold.

The owner now wants a **different** shape: a **compact wrapping row of
style-NAME-only chips** (~9 for Composite, ~6 for Fundamental), shown
**INLINE and always visible** (no disclosure), with each chip's blurb moved
into a **tooltip that appears on hover AND on keyboard focus**. A compact chip
row is short enough that it no longer buries the weight inputs, so the
disclosure is no longer needed and is removed.

Nothing about scoring, presets, values, API, DB, the weight inputs, the status
line, Reset/Save, or the populate-only "click a chip → `setInputs(...)`"
mechanism changes. This is purely the picker's *presentation*: rows → chips,
remove the disclosure, blurb → accessible hover+focus tooltip.

## The design tension this plan MUST resolve (do not gloss over it)

**This change reverses ADR-24's central decision.** ADR-24 deliberately moved
the blurb FROM a `title` tooltip TO always-visible text because a tooltip is
"invisible on touch, on scan, and to most users." Moving the blurb back into a
tooltip re-opens that exact question. The plan resolves it two ways:

1. **A new ADR-26 explicitly supersedes ADR-24's visible-description decision**
   (and partially supersedes ADR-25's collapse) and records the tradeoff the
   owner is accepting: **compactness and name-scannability of a short chip row
   over always-visible descriptions.** The rationale the owner chose it now:
   with the descriptions always visible the list was tall enough to need a
   collapse (ADR-25); a name-only chip row is compact enough to sit inline
   above the inputs with no collapse, and most users pick a style by its *name*
   (Value / Growth / Momentum / …), reaching for the description only when a
   name is ambiguous — for which an on-demand tooltip is the right affordance,
   *provided it is not the bare `title` tooltip ADR-24 rejected.*

2. **The tooltip must NOT reintroduce the accessibility regression ADR-24
   fixed.** A bare HTML `title` attribute is banned: it is mouse-only
   (no keyboard-focus reveal), invisible on touch, and screen-reader behaviour
   for it is inconsistent. The replacement must be a **real, accessible
   tooltip** that:
   - opens on **hover** AND on **keyboard focus** (Tab to the chip → tooltip
     shows), and closes on blur / mouse-leave;
   - is **dismissible with Escape** while focused;
   - links the chip to its description via **`aria-describedby`** so a screen
     reader announces the blurb as the chip's description (not only its name);
   - has a documented **touch story** (see Assumptions — Radix tooltips do not
     open on tap; the chip's own accessible *name* is the style name, which is
     self-describing, and the blurb is supplementary, so touch users are not
     blocked from choosing a style — this is the accepted tradeoff, recorded in
     ADR-26).

**Reuse the existing tooltip primitive.** The repo already has a Radix-based
tooltip at `components/ui/tooltip.tsx` (`Tooltip`, `TooltipTrigger`,
`TooltipContent`, `TooltipProvider`) — shadcn-derived, styled with the
`--popover`/`--popover-foreground`/`border` tokens (all present in
`app/globals.css`, light + dark). It satisfies the entire a11y contract above
**for free**: Radix Tooltip opens on hover and on focus, wires
`aria-describedby` from `TooltipTrigger` to `TooltipContent` automatically,
and closes on Escape. **Prefer it over building a new tooltip.** The one wiring
gap is that it is currently imported nowhere and **no `TooltipProvider` is
mounted in the app tree** — Radix Tooltip requires a `TooltipProvider`
ancestor. This plan adds that provider (see Tasks).

## Approach

**Files touched are exactly the same three the collapse touched, plus one
provider file:** `app/(dashboard)/settings/page.tsx`,
`app/(dashboard)/settings/loading.tsx`, `DESIGN.md`, `DECISIONS.md`, and a
one-line `TooltipProvider` mount (see Task 1 for where). No scoring util, no
service, no API route, no schema, no test for scoring math is touched — the
grep invariant (`intrinsicValue:\s*0\.25` / `valuation:\s*0\.3` found only in
`lib/utils/scoring-weights.ts`) is unaffected because this plan does not touch
that file at all.

### 1. Mount a `TooltipProvider`

Radix `Tooltip` throws / silently no-ops without a `TooltipProvider` ancestor.
Mount it once. **Preferred placement: inside `ScoringWeightsSection`'s returned
JSX** (wrap the section's content, or just the chip row, in
`<TooltipProvider delayDuration={...}>`), keeping the provider scoped to where
tooltips are actually used and avoiding a global app-tree change in a
picker-only plan. A section-local provider is sufficient because tooltips only
exist inside the chip row. (Do **not** add it to `components/providers.tsx` —
that is a broader change than this task needs, and `providers.tsx` is a
load-bearing app-wide file; keep the blast radius to the settings surface. If
the Coding agent finds a concrete reason a section-local provider misbehaves,
that is an Open decision to surface, not a silent escalation to the global
tree.)

`delayDuration` should be short enough to feel responsive but not instant —
the Designer sets the exact value against the app's motion language (the
200ms/250ms register already documented in DESIGN.md); the plan does not pin a
number, only requires hover **and** focus both trigger it.

### 2. Replace the disclosure + row list with an inline compact chip row

In `ScoringWeightsSection` (`page.tsx`):

- **Remove** the `<details className="group">` / `<summary>` disclosure wrapper
  (lines ~225–247), including the `<ChevronDown>` trigger and its
  `group-open:rotate-180` rotation. Remove the now-unused `ChevronDown` import.
- **Keep** a compact **kicker label** ("Start from a style") as a plain,
  always-visible text node above the chip row (it is no longer a `<summary>`;
  it is back to a standalone kicker, as it was pre-ADR-25). Same class/copy as
  the existing kicker.
- **Render `presetsForGroup(group)` as a wrapping row of name-only chips** —
  one chip per preset, chip text = `preset.label` only (NO blurb text in the
  chip). Each chip is a native `<button type="button">` whose `onClick` is the
  **unchanged** `setInputs(toInputs(preset[group]! as Record<K, number>))`.
  The chip row is inline and always visible, sitting directly below the status
  line and above the five Weight stepper fields — the same slot the picker has
  always occupied.
- **Wrap each chip in the accessible tooltip:** the chip is the
  `TooltipTrigger` (use `asChild` so the trigger *is* the `<button>`, not a
  wrapper element), and `TooltipContent` renders `preset.blurb`. Radix wires
  `aria-describedby` from trigger to content automatically; hover and focus both
  open it; Escape dismisses it. **Do not use a `title` attribute for the
  blurb** (that is the banned regression).
- **No active/selected chip state.** A chip is a momentary action, not a toggle
  — clicking it populates the fields and nothing paints it as "currently
  selected" (ADR-23/24/25's no-active-state rule is preserved verbatim). Do not
  add comparison logic to highlight the chip whose values match the current
  inputs.

The exact chip visual (padding, radius, border/fill, wrap behaviour, gap) and
the tooltip's visual chrome/placement are the **Designer's** call, bounded to
existing `DESIGN.md` tokens (`--line`, `--line2`, `--fill`, `--mut`, `--ink`,
`--popover`/`--popover-foreground` for the tooltip surface — all already
present). The plan fixes only the functional + a11y contract; it does not pin
pixel values.

### 3. Update `loading.tsx` skeleton to match the new inline chip-row first paint

`app/(dashboard)/settings/loading.tsx`'s preset-picker skeleton block currently
mirrors the **collapsed disclosure** (a single kicker-variant `SkeletonText` +
a `h-4 w-4` chevron-footprint `SkeletonBlock`, lines ~41–44). Replace it with a
skeleton approximating the **inline chip row**: a short kicker-variant
`SkeletonText` for the "Start from a style" label, followed by a **wrapping row
of several small pill/chip-shaped `SkeletonBlock`s** approximating the chips
(no chevron, no disclosure). This keeps first-paint shape parity — the route
skeleton must render the same shape the live picker renders on first paint (an
inline chip row), or the page will visibly reflow when data resolves.

### 4. Supersede ADR-24 (visible descriptions) and partially supersede ADR-25 (collapse); add ADR-26

- **Add ADR-26** to `DECISIONS.md` recording: name-only chips + accessible
  hover/focus tooltip, shown inline (disclosure removed), the tradeoff
  (compactness over always-visible descriptions), the a11y contract that keeps
  it from being ADR-24's banned bare-`title` regression, and reuse of the
  existing `components/ui/tooltip.tsx` primitive + the newly-mounted
  `TooltipProvider`.
- **Annotate ADR-24**: mark its "blurbs shown as always-visible text" decision
  **superseded by ADR-26** (the blurb *values/copy* and the *weight retune*
  ADR-24 also carries are NOT superseded — only the always-visible-text
  presentation choice; the blurbs still exist, now shown in tooltips). Add a
  one-line `Superseded-by: ADR-26 (presentation only — blurb copy and weight
  values stand)` note to ADR-24's Status line. Do not delete ADR-24.
- **Annotate ADR-25**: mark it **superseded by ADR-26** (the collapse is
  removed in favour of an inline chip row). Add `Superseded-by: ADR-26` to its
  Status line. Do not delete ADR-25.

### 5. Update DESIGN.md

The "Style preset picker (Settings — scoring weights)" component entry and the
"Settings — scoring weights" UX flow are the **Designer's** to revise (this is
a Planner session — the plan does not rewrite DESIGN.md's component spec). The
plan flags what must change so the Designer stage has a precise brief:
- The "Latest revision" (collapsed disclosure, ADR-25) is superseded — the new
  latest revision is the inline name-chip row + accessible tooltip.
- The always-visible-row-list revision (ADR-24 shape) is superseded as the
  *presentation*, but its "No 'selected'/active-preset visual state, ever" rule
  and its populate-only Interaction section carry forward unchanged.
- The tooltip needs a spec entry (surface = `--popover`, a11y contract:
  hover+focus trigger, `aria-describedby`, Escape-dismiss, touch note) — the
  Designer specs its visual chrome against existing tokens; the plan fixes the
  functional contract above.

(Planner writes the ADR-26 stub, the ADR-24/25 supersede annotations, and this
plan file. The Designer stage owns the DESIGN.md component-spec rewrite; the
Coding agent implements against the finalized spec.)

## Tasks

1. [ ] Mount a `TooltipProvider` scoped to the settings picker (section-local
   in `ScoringWeightsSection`, NOT in `components/providers.tsx`) — Acceptance:
   a Radix `Tooltip` inside `ScoringWeightsSection` renders without the
   "Tooltip must be used within TooltipProvider" console error; hovering or
   focusing a chip opens its tooltip.
2. [ ] Replace the `<details>/<summary>` disclosure + full-width row list with
   an inline, always-visible wrapping row of name-only chips
   (`preset.label` text, one `<button type="button">` per preset from
   `presetsForGroup(group)`), removing the `ChevronDown` import and its
   `group-open:rotate-180` rotation — Acceptance: on the Settings page both
   Composite (9 chips) and Fundamental (6 chips) render an inline chip row with
   NO disclosure/chevron and NO scrolling to reach the Weight stepper fields;
   the DOM contains no `<details>`/`<summary>` in `ScoringWeightsSection`.
3. [ ] Wire each chip's blurb into the existing `components/ui/tooltip.tsx`
   (`Tooltip`/`TooltipTrigger asChild`/`TooltipContent`), NOT a `title`
   attribute — Acceptance: hovering a chip shows its blurb; **Tab-focusing** a
   chip (keyboard, no mouse) shows its blurb; the focused chip carries an
   `aria-describedby` pointing at the tooltip content's id; pressing Escape
   while the chip is focused dismisses the tooltip; no chip has a `title`
   attribute carrying the blurb.
4. [ ] Preserve populate-only, no-active-state behaviour — Acceptance: clicking
   a chip calls `setInputs(toInputs(preset[group]!))` and populates the five
   fields (e.g. Composite → Deep Value / Contrarian populates 55/30/0/0/15);
   NO `PUT /api/settings/scoring-weights` fires on chip click (only on Save);
   no chip is painted as "selected/active" before or after clicking; the status
   line flips to "Total: 100% · valid" and Save enables via the existing dirty
   gate.
5. [ ] Update `app/(dashboard)/settings/loading.tsx` skeleton to an inline
   chip-row shape (kicker + wrapping row of small chip `SkeletonBlock`s, no
   chevron/disclosure) — Acceptance: rendering `loading.tsx` shows a chip-row
   skeleton, not a collapsed-trigger row; first paint → resolved does not
   reflow the picker's vertical footprint noticeably.
6. [ ] Add ADR-26 to `DECISIONS.md`; annotate ADR-24 and ADR-25 as superseded
   by ADR-26 (Status lines only — do not delete either) — Acceptance:
   `DECISIONS.md` contains ADR-26; ADR-24's and ADR-25's Status lines carry a
   `Superseded-by: ADR-26` note; ADR-24's blurb copy and weight values are
   unchanged (only its always-visible-presentation choice is marked
   superseded).
7. [ ] DESIGN.md "Style preset picker" + "Settings — scoring weights" UX flow
   updated to the inline-chips + accessible-tooltip revision (Designer stage) —
   Acceptance: DESIGN.md's latest picker revision describes name chips + a
   hover/focus tooltip on `--popover`, references only existing tokens, and its
   a11y note matches the contract in this plan (hover+focus, `aria-describedby`,
   Escape, touch note); no residual "collapsed disclosure" as the current
   shape.

Task status markers ([ ] todo · [~] in progress · [x] done · [!] blocked) are
maintained by the Coding agent in this file as it works.

## Files to create or modify

- `app/(dashboard)/settings/page.tsx` — remove disclosure, render inline name
  chips, wrap each in the accessible tooltip, mount section-local
  `TooltipProvider`, drop the `ChevronDown` import.
- `app/(dashboard)/settings/loading.tsx` — chip-row skeleton in place of the
  collapsed-trigger skeleton.
- `DECISIONS.md` — add ADR-26; annotate ADR-24 and ADR-25 Status lines
  (Planner writes these in this session).
- `DESIGN.md` — "Style preset picker" component entry + "Settings — scoring
  weights" UX flow revised to the inline-chips + tooltip shape (Designer stage).
- `components/ui/tooltip.tsx` — reused as-is; no change expected (verify its
  `--popover` classes render in both themes; if a token is missing it is an
  Open decision, but all required tokens are confirmed present).

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically and
must pass (typecheck, lint, tests, secret-scan). No scoring/settings unit test
changes are expected — this is a presentational change to `page.tsx`/`loading.tsx`;
`scoring-weights.test.ts`, `scoring-weights-settings-gate.test.ts`, and the
settings route/service tests must stay green untouched (a change to any of them
is a signal the change leaked past presentation and should be reviewed).

Beyond the Verify block, the Coding agent runs these **manual/live** checks
(the same class of Playwright-against-dev-server checks ADR-23/24/25 used):

1. **Inline, no collapse** — on `/settings`, both Composite (9) and Fundamental
   (6) chip rows are visible on first load with the five Weight stepper fields
   also visible without scrolling; there is no `<details>`/chevron.
2. **Hover reveals blurb** — hovering a chip shows its blurb in a tooltip on the
   `--popover` surface.
3. **Keyboard focus reveals blurb (the ADR-24 regression guard)** — Tab to a
   chip with the keyboard only; the tooltip appears; the chip has
   `aria-describedby` referencing the tooltip content; Escape dismisses it.
   This is the check that proves the change is NOT a bare-`title` regression.
4. **No `title` attribute** — inspect a chip; it carries no `title` attribute
   holding the blurb.
5. **Populate-only, no active state** — clicking a chip populates the five
   fields with that preset's percents, fires NO `PUT` (request-interception),
   flips the status line to valid, enables Save via the dirty gate, and leaves
   no chip visually marked as selected.
6. **Skeleton parity** — rendering `loading.tsx` shows an inline chip-row
   skeleton (no chevron), matching the live first-paint shape.

## Assumptions

1. **Reuse `components/ui/tooltip.tsx` (Radix) rather than build a new tooltip.**
   It already satisfies the full a11y contract (hover + focus open,
   `aria-describedby`, Escape-dismiss) and is styled on the `--popover` tokens,
   which exist in both themes. Building a bespoke tooltip would duplicate a
   working primitive for no benefit. If the Coding agent finds the primitive
   genuinely unusable here (e.g. an unresolvable styling/token conflict), that
   is an Open decision to surface, not a silent pivot to a hand-rolled tooltip.
2. **`TooltipProvider` is mounted section-local (in `ScoringWeightsSection`),
   not in `components/providers.tsx`.** This keeps the blast radius to the
   settings surface — a picker-only plan should not modify the app-wide
   provider tree. A section-local provider is sufficient because tooltips exist
   only inside the chip row.
3. **Touch/tap does not open the tooltip — and that is acceptable here.** Radix
   Tooltip (like most accessible tooltip patterns) opens on hover and focus,
   not on tap. This does NOT re-create ADR-24's regression the way a bare
   `title` did, because: (a) the chip's accessible *name* is the style name
   (Value / Growth / …), which is self-describing — a touch user can still
   choose a style without the blurb; (b) the blurb is supplementary context,
   not required to act; (c) this app is web-only, desktop-primary (PRODUCT.md:
   "No mobile app — web only"), so hover+focus covers the primary input
   modalities. The touch limitation is recorded in ADR-26 as an accepted
   tradeoff rather than left implicit. If the owner later wants tap-to-reveal on
   touch, that is a follow-up (e.g. a tap-toggle popover), not in scope here.
4. **The kicker label reverts to a standalone always-visible text node** (as it
   was before ADR-25 made it a `<summary>`), sitting above the chip row.
5. **The blurb copy and the preset weight *values* (ADR-24's retune) are
   unchanged** — only the presentation of the blurb (always-visible text →
   tooltip) and the picker's chrome (rows-in-disclosure → inline chips) change.

## Open decisions (if any)

None. The owner has already decided: compact name-only chips + hover/focus
tooltip, shown inline, disclosure removed, populate-only, no active-state. The
tooltip-primitive reuse and section-local provider placement are recorded as
Assumptions above (approving this plan approves them). If, during
implementation, the Radix primitive proves unusable or a section-local provider
misbehaves, the Coding agent surfaces it rather than choosing an alternative
tooltip approach unilaterally.
