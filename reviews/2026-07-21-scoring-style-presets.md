# Review: named investment-style scoring-weight presets (ADR-23)
Date: 2026-07-21
Status:

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: SP-I1 (ISSUE), SP-S1 (SUGGESTION)

Review target: branch HEAD of `plan/scoring-style-presets` (`2838e010`), diffed
against the merge-base with `origin/main` (`5f6e9515`). Working tree clean except
the orchestrator's in-flight `STATUS.md` (expected under the orchestrate pipeline,
not a BLOCKER). `npm run verify` green: typecheck ok, lint ok (pre-existing
warnings only, none in the changed files), 240/240 tests, secret-scan clean.

The implementation is correct and faithful to the plan and ADR-23. All the crux
points hold:
- **(a) Sums.** All eight non-Balanced composite groups and all five
  non-Balanced fundamental groups sum to exactly 100, and every value matches the
  plan's data tables byte-for-byte (verified numerically against the plan tables,
  and asserted by the new unit tests).
- **(b) Balanced derived, not typed.** `balanced.composite`/`balanced.fundamental`
  are `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`, not literals, and locked by
  two deep-equal unit tests.
- **(c) Client-side populate only.** The picker's `onClick` calls
  `setInputs(toInputs(preset[group]!))` — the identical mechanism `handleReset`
  uses (`page.tsx:174`). A `PUT` fires only in `handleSave`, bound solely to the
  Save button. Applying a preset flows through the unchanged `computeGroupTotalState`
  → `canSave` gate with no special-casing; it cannot bypass the sum-to-100 + dirty
  gate.
- **(d) `presetsForGroup` exclusion.** Filters on `preset[group] !== undefined`;
  momentum/sentiment/analyst carry no `fundamental` key, so `presetsForGroup("fundamental")`
  returns six (verified by data and by test).
- **(e) ADR-23 count.** "nine composite / six fundamental" is internally
  consistent across DECISIONS.md (ADR-23), AGENT.md, the plan, and DESIGN.md.

Security pass: performed manually against the merge-base range (the
`security-review` skill diffs the working tree against HEAD and has no meaningful
input on an already-committed branch — skipped for that reason). No security
surface is touched: no new API route, no auth/permission change, no
schema/migration, no credentials, no injection surface. The only runtime addition
is client-side pure data (`SCORING_STYLE_PRESETS`), a pure filter
(`presetsForGroup`), and a populate-only `<button>` that issues no network
request. The `preset[group]! as Record<K, number>` non-null assertion is safe: the
button is only rendered from `presetsForGroup(group)`, which guarantees the group
is present. No security findings.

## Findings

### SP-I1 — ISSUE
**File:** `app/(dashboard)/settings/loading.tsx` (unchanged) vs. `DESIGN.md`
"settings/loading.tsx" skeleton row + "Style preset picker" spec (both revised in
this commit)
**Problem:** DESIGN.md's per-route skeleton table row for `settings/loading.tsx`
was amended in this same commit to require, per this plan, "another short
`kicker`-variant block (the preset picker's label) followed by a small wrapped row
of 3–4 `pill`-variant blocks (the preset picker itself)" between the status-line
block and the five stepper rows. `app/(dashboard)/settings/loading.tsx` was **not**
updated — it still renders only the status-line kicker block, the five
label+field rows, and the actions pills. This is doc-vs-code drift introduced by
the change, and it also violates DESIGN.md's own standing "Rule for the Coding
agent" ("every skeleton mirrors its real page's ... block order ... Coding agent
updates `loading.tsx` in the same change"). The live page now has a picker block
the skeleton does not account for, so the loading state and the loaded state
disagree on block order/height. Cosmetic only (no correctness or data risk), which
is why this is an ISSUE, not a BLOCKER.
**Recommendation:** in `app/(dashboard)/settings/loading.tsx`, inside each
section's `SkeletonCard`, add between the status-line `SkeletonText variant="kicker"`
(line 32) and the stepper grid (line 34): one short `kicker`-variant block (the
"Start from a style" label) and a `flex flex-wrap gap-2` row of 3–4 `pill`-variant
`SkeletonText` blocks of varied width — exactly as the revised DESIGN.md row
describes (a representative sample, not the real 9/6 count). Update the file's
header comment to mention the added preset-picker skeleton blocks.

### SP-S1 — SUGGESTION
**File:** `app/(dashboard)/settings/page.tsx:235`
**Problem:** The pill uses `border-line`, and there is no `--line` CSS variable
or `line` Tailwind color mapped in `tailwind.config.js` (only `line2` →
`var(--line2)` and `fill` → `var(--fill)` exist). `border-line` therefore does not
resolve to a themed token; it falls through to a Tailwind/browser default. This is
**pre-existing and repo-wide** — the sibling Reset button (`page.tsx:262`) and 7+
other components (`transactions-tab.tsx`, `technical-analysis.tsx`,
`analyst-ratings.tsx`, `fundamental-analysis.tsx`, `portfolio/[ticker]/page.tsx`)
all use `border-line` — and the picker correctly matches the exact class its
sibling Secondary buttons already use, so it introduces no new inconsistency.
DESIGN.md's "Style preset picker" spec repeatedly cites a `--line` token as the
pill border, which reinforces that the token is *intended* to exist. Flagging only
because this feature's DESIGN.md entry newly documents `--line` as a real themed
token when the codebase has no such variable.
**Recommendation:** Out of scope for this feature (do not change the picker — it
must stay consistent with its neighbours). Consider logging a `TECH_DEBT.md` item
to either (a) define `--line`/`line` as a real themed token in
`app/globals.css`/`tailwind.config.js` so the many `border-line` usages resolve to
an intended color, or (b) migrate them to `border-line2` and correct DESIGN.md's
`--line` references. A single repo-wide decision, not a per-feature fix.

## Proposed DECISIONS.md entries
None. ADR-23 is already present in `DECISIONS.md`, `AGENT.md`, `ARCHITECTURE.md`,
and `DESIGN.md`, and accurately reflects the implementation. No new decision was
surfaced by this review.
