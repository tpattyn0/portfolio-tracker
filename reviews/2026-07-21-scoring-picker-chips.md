# Review: scoring-picker-chips (inline name-chip picker + accessible tooltip, ADR-26)
Date: 2026-07-21
Status:

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: PCH-I1 (plan INDEX lifecycle drift), PCH-S1 (optional)

Reviewed **branch HEAD** `af9b835f` of `feature/scoring-picker-chips` (PR #27),
isolated to this feature's own diff via `git diff feature/scoring-picker-ux...HEAD`
(three-dot against the PR base branch). The presets (#24), retune (#25), and
collapsible picker (#26) that already landed on the base branches were NOT
re-reviewed. Working tree clean (`git status --porcelain` empty), branch
up-to-date with origin. `npm run verify` green: typecheck ok · lint ok (only
pre-existing warnings in unrelated files — none in the diff) · 254/254 tests ·
secret-scan clean.

This is a presentation-only change: rows-in-a-`<details>`-disclosure → an
inline wrapping row of name-only chips, each blurb on an accessible Radix
hover/focus tooltip. Feature diff touches exactly two code files
(`app/(dashboard)/settings/page.tsx`, `app/(dashboard)/settings/loading.tsx`)
plus docs (`AGENT.md`, `DECISIONS.md`, `DESIGN.md`, `STATUS.md`, the plan, and
`plans/INDEX.md`). No `lib/`, no `app/api/`, no `components/` (including
`components/ui/tooltip.tsx`), no schema touched. All crux items verified against
the code below.

Security pass: the `security-review` skill diffs the working tree against HEAD;
the tree is clean (nothing to diff), so per the Reviewer instructions the skill
was skipped and the security pass was done manually against the
`feature/scoring-picker-ux...HEAD` range. This diff has no security surface: no
new endpoint, no auth path, no credentials, no data flow. Preset `blurb` strings
are static copy rendered as React text nodes inside `TooltipContent` (React
auto-escapes; no `dangerouslySetInnerHTML`). Nothing to flag.

## Crux-item verification (all pass)

- **(a) Accessibility contract — PASS.** Each chip's `blurb` is rendered via the
  Radix primitive `Tooltip` / `TooltipTrigger asChild` / `TooltipContent`
  (`app/(dashboard)/settings/page.tsx:230-241`), NOT a `title` attribute. Grep
  confirms no HTML `title` attribute carries the blurb (the only `title=` hits in
  the file are the `ScoringWeightsSection` React `title` prop at lines 103/114 —
  the section headings "Composite score"/"Fundamental score", unrelated).
  `TooltipTrigger asChild` wraps the actual `<button>` directly (no intervening
  wrapper element), so focus lands on the trigger and Radix supplies native
  hover+keyboard-focus open, `aria-describedby`, and Escape-dismiss. The primitive
  `components/ui/tooltip.tsx` is reused unchanged. Bare-`title` ADR-24 regression
  is NOT reintroduced.

- **(b) TooltipProvider placement — PASS (section-local, and AGENT.md now agrees).**
  The `TooltipProvider delayDuration={200}` is mounted **inside**
  `ScoringWeightsSection` (`page.tsx:227`), wrapping only that section's chip row —
  section-local, exactly as the plan required. `components/providers.tsx` is NOT
  in the feature diff (`git diff --name-only` confirms it is untouched). The
  discrepancy flagged in the task (coding-agent summary allegedly describing a
  "single app-wide TooltipProvider") does NOT exist in the committed branch HEAD:
  the committed `AGENT.md` ADR-26 note now correctly states the provider is
  mounted "section-local, inside `ScoringWeightsSection`" and explicitly says
  `components/providers.tsx` does NOT have one. Code and doc agree; neither an
  app-wide-provider scope-creep issue nor a misleading-doc issue applies.

- **(c) Disclosure removed cleanly — PASS.** `<details>`/`<summary>`/`ChevronDown`
  are gone; the `import { ChevronDown } from "lucide-react"` line is removed
  (lint green — no unused import). "Start from a style" is now a plain
  `<span>` text node (`page.tsx:226`). Grep for `ChevronDown|<details|<summary`
  under `app/(dashboard)/settings/` returns nothing. No dead code from the
  collapse remains.

- **(d) Populate-only + no active state — PASS.** Chip `onClick` still calls
  `setInputs(toInputs(preset[group]!...))` (`page.tsx:234`) — no `PUT` on click,
  no selected/active chip highlight. Weight inputs, status line, Save gate,
  presets, blurbs, `lib/utils/scoring-weights.ts`, the API routes, and the gate
  module are all UNTOUCHED (empty diff confirmed on `lib/` and `app/api/`).

- **(e) Skeleton parity — PASS.** `loading.tsx` now renders an inline chip-row
  skeleton (a `variant="kicker"` block + a `flex flex-wrap` row of six
  `h-8 w-20 rounded-full` `SkeletonBlock`s, no chevron), matching the new first
  paint; the old collapsed-trigger-row block (kicker + `h-4 w-4` chevron
  footprint) is removed.

- **(f) ADR-26 + supersede annotations — PASS.** ADR-26 present, Status
  `accepted (implemented 2026-07-21)`, with real file:line evidence and an
  accurate tradeoff + a11y-contract record. ADR-24 and ADR-25 carry
  `Superseded-by ADR-26` annotations without deleting their content; ADR-24
  explicitly scopes the supersede to its always-visible-presentation choice only
  and states its weight *values* and rewritten `blurb` copy are NOT superseded.
  The AGENT.md ADR-25 fragile-surface note is struck through and points to the
  new ADR-26 note.

- **(g) Dark mode — PASS (token-based).** `TooltipContent` uses
  `bg-popover text-popover-foreground` (`components/ui/tooltip.tsx:22`), and
  `--popover`/`--popover-foreground` are defined for both light and dark themes
  in `DESIGN.md` (lines 62-63). No hardcoded light-only color. Token usage is
  sufficient; the coding agent's not re-screenshotting dark mode is acceptable.

## Findings

### PCH-I1 — ISSUE
**File:** `plans/INDEX.md:5`
**Problem:** The plan row for `plans/2026-07-21-scoring-picker-chips.md` still
reads Status `planned`, but the implementation is committed on the branch with
PR #27 open and under review. Per the plan lifecycle in `CLAUDE.md`, the row
should be `implementing`/`in review` at this point (and every sibling landed
feature in this stack shows the completed lifecycle). Left as `planned`, the
index misrepresents live work state. This is doc-lifecycle drift, not a code
defect.
**Recommendation:** In the Coding agent session, set the row to `in review`
(PR open) now, then to `implemented` with `Review:
reviews/2026-07-21-scoring-picker-chips.md` in the same commit that stamps this
review file `Status: IMPLEMENTED`.

### PCH-S1 — SUGGESTION
**File:** `app/(dashboard)/settings/page.tsx:227`
**Problem:** Each `ScoringWeightsSection` mounts its own `TooltipProvider`. This
is correct and matches the plan (section-local, minimal blast radius), and with
only two sections the duplication is negligible. Noting only that if the settings
page later grows more tooltip surfaces, a single provider at the page-component
level (still not app-wide `providers.tsx`) would be marginally cleaner. No action
required now — the current placement is the intended design and the AGENT.md note
correctly documents the "promote to app-wide is a decision to surface, not
assume" boundary.
**Recommendation:** Leave as-is unless a third tooltip surface is added to this
page; then consider hoisting to one page-level provider.

## Proposed DECISIONS.md entries
None — ADR-26 is already present and accurate; ADR-24/25 supersede annotations
are already applied correctly. No new ADR needed.
