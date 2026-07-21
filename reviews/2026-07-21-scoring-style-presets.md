# Review: named investment-style scoring-weight presets (ADR-23)
Date: 2026-07-21
Status:

## Summary
Findings: 0 BLOCKERs, 0 open ISSUEs, 0 open SUGGESTIONs, 0 QUESTIONs
(iteration 1: 1 ISSUE, 1 SUGGESTION — both now resolved/dispositioned, see below)
Requires owner decision: none
Ready for Coding agent: none — branch is clean

### Iteration 2 (2026-07-21) — clean

Review target: branch HEAD of `plan/scoring-style-presets` (`333380a5`), iteration-2
diff (`951085ba..HEAD`) reviewed on top of iteration 1. The only code/doc changes
since iteration 1 are the two fixes below plus an orchestrator `STATUS.md` bump;
the core feature (`lib/utils/scoring-weights.ts`, `app/(dashboard)/settings/page.tsx`)
is byte-identical to iteration 1 (`git diff 951085ba..HEAD` on those two files is
empty) and was not re-reviewed in full. Working tree clean. `npm run verify` green:
typecheck ok, lint ok (pre-existing warnings only, none in the changed files),
240/240 tests, secret-scan clean.

- **SP-I1 — RESOLVED.** `app/(dashboard)/settings/loading.tsx` (`9c51ccb8`) now
  renders, between the status-line `kicker` block and the 5-row stepper grid, a
  short `kicker`-variant label block (`w-32`) over a `flex flex-wrap gap-2` row of
  four `pill`-variant blocks of varied width (`w-20/w-24/w-16/w-28`), applied to
  both sections via the existing `[0,1].map`. **Correct against all three checks:**
  (1) block order now mirrors the real page exactly — header rule (`page.tsx:210`)
  → group-total status line (`:215`) → preset picker "Start from a style" label +
  wrapped pill row (`:224-241`) → stepper grid (`:243`) → Reset pills (`:258`);
  (2) uses only existing `SkeletonText` variants (`kicker`, `pill` — both defined
  in `components/ui/loading-skeleton.tsx`, no new variant introduced); (3) matches
  DESIGN.md's revised spec (per-route table row `settings/loading.tsx` and the
  "Loading state" prose) — a 3–4 pill representative sample, not the real 9/6
  count. The file header comment was updated to describe the added blocks. No new
  issue introduced.
- **SP-S1 — DISPOSITIONED to TD-36 (no code change), as this review's own
  recommendation directed.** `TECH_DEBT.md`'s TD-36 row was widened ("**Widened
  2026-07-21**") to record the picker (`page.tsx:235`) and settings Reset button
  (`page.tsx:262`) as two further pre-existing `border-line` sites, and to note
  that DESIGN.md's new "Style preset picker" spec cites `--line` as a themed token
  the codebase lacks — so the repo-wide `border-line`/`--line` decision is now
  overdue. The edit is well-formed (table row structure intact, all cells present)
  and accurate (verified `border-line` still resolves to no themed token — only
  `line2`/`fill` exist in `tailwind.config.js`; the picker correctly matches its
  sibling Reset button's class, introducing no new inconsistency). The fix column
  correctly keeps this a single repo-wide Designer decision, not a per-feature fix,
  and adds the DESIGN.md `--line` correction as a follow-up once decided. Correct
  disposition — nothing further owed on this branch.

Security pass (iteration 2): the iteration-2 diff touches only a client-side
skeleton component (`loading.tsx` — pure presentational, no user input, no data
flow, no network) and two doc files (`TECH_DEBT.md`, `STATUS.md`). No security
surface. The `security-review` skill diffs the working tree against HEAD and has
no meaningful input on this already-committed branch — its framework was run as
reference and the pass was completed manually against the `951085ba..HEAD` range,
consistent with iteration 1. No findings.

**Disposition: this branch is clean and ready for owner merge.** No BLOCKERs, no
open ISSUEs/SUGGESTIONs, no QUESTIONs. SP-S1's underlying token cleanup lives on
in TD-36 for a future repo-wide pass; it does not gate this feature.

---

### Iteration 1 (2026-07-21) — original findings (retained for history)

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

### SP-I1 — ISSUE — RESOLVED (iteration 2, `9c51ccb8`; see Iteration 2 note above)
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

### SP-S1 — SUGGESTION — DISPOSITIONED to TD-36 (iteration 2; see Iteration 2 note above)
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
