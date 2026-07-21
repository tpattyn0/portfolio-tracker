# Review: scoring-style descriptions + signal-diagnostic weight retune
Date: 2026-07-21
Status: IMPLEMENTED — 2026-07-21

## Summary
Findings: [0 BLOCKERs, 1 ISSUE (RTN-I1 — RESOLVED in iteration 2), 0 SUGGESTIONs, 0 QUESTIONs]
Requires owner decision: none
Ready for Coding agent: none — the sole ISSUE (RTN-I1) is now resolved; branch is clean.

**Iteration 2 verdict (2026-07-21): CLEAN.** The only ISSUE from iteration 1,
RTN-I1, is fully resolved and no new issue was introduced. See the
"## Iteration 2 — RTN-I1 verification" section below. The iteration-1 record
that follows is retained unchanged for history.

Reviews the iteration-1 diff of `plans/2026-07-21-scoring-style-descriptions-retune.md`
on `feature/scoring-style-descriptions-retune` (PR #25), isolated against its PR base
`plan/scoring-style-presets` (`git diff plan/scoring-style-presets...HEAD`, merge-base
`af5e0f38`). The PR #24 preset feature already on the base branch (reviewed in
`reviews/2026-07-21-scoring-style-presets.md`) was not re-reviewed. Verdict: clean,
tightly-scoped data/copy/UI change; every retuned weight matches the plan's final tables
and sums to exactly 100; zeros are handled correctly; Balanced stays derived; the picker
and skeleton match the revised DESIGN.md spec; ADR-24 is accurate. One minor doc-drift
ISSUE (plan's draft blurb list vs. shipped blurb copy).

### Security pass (Step 1)
The `security-review` skill diffs the working tree against HEAD; this branch's tree is
clean and the review target is already-committed branch HEAD, so the skill has no
meaningful input — skipped per the Reviewer protocol and the pass done manually against
`plan/scoring-style-presets...HEAD`. This diff touches only pure settings-layer data
(`SCORING_STYLE_PRESETS` numbers/copy), one client `page.tsx` picker (populate-only,
no request), `loading.tsx`, tests, and docs. No new/changed API route, no auth surface,
no DB/migration, no injection sink, no secret. `npm run verify` secret-scan: clean.
No security findings.

## Findings

### RTN-I1 — ISSUE (RESOLVED in iteration 2 — see "## Iteration 2" section)
**File:** plans/2026-07-21-scoring-style-descriptions-retune.md:267-274 (plan "Blurb copy" draft) vs. lib/utils/scoring-weights.ts:295-343 (shipped `blurb` strings)
**Problem:** Six of the nine shipped blurbs differ in wording from the plan file's own
"Blurb copy" draft list. The numbers are identical everywhere; only phrasing diverges,
e.g.:
- value — plan "…with a safe balance sheet; ignores price and news." → shipped "…with solid, safe fundamentals."
- deep-value — plan "…and balance-sheet survivability for distressed or contrarian names." → shipped "…for distressed or contrarian turnarounds."
- quality — plan "…steady growth at a still-reasonable price." → shipped "durable profitability and growth at a still-reasonable price."
- growth — plan "…with analyst coverage and a light price/news confirm; ignores DCF cheapness." → shipped "…the business compounding, not the price chart."
- momentum — plan "…fundamentals and valuation barely count." → shipped "fundamentals barely count."
- income — plan "…backed by stable fundamentals and analyst coverage." → shipped "over price appreciation."

The plan itself anticipates copy polish (§ "Assumptions"/closing notes, lines 407-408:
"Blurb wording may be polished by the Designer/GTM stage; the plan fixes that each blurb
states what the style *optimizes for*, one line, diagnostic"), and the shipped strings do
satisfy that invariant (each states what the style optimizes for, one line, diagnostic).
So this is anticipated, low-severity drift — not a correctness defect. It is flagged only
so the plan file's draft list is not left silently misrepresenting what actually shipped;
the value-lock unit test (`scoring-weights.test.ts` "every preset's blurb states what the
style optimizes for") already pins the shipped strings, so the code side is authoritative.
**Recommendation:** Update the plan's "Blurb copy" list (lines 267-274) to match the nine
shipped `blurb` strings verbatim so plan and code agree. Docs-only edit on this same
branch; no code change. Alternatively the owner may decide the plan's draft-section
caveat makes this acceptable as-is and close without action — either resolution is fine.

## What was verified (no findings)

**(a) Retuned weights — all correct, all sum to exactly 100.** Every composite and
fundamental group in `SCORING_STYLE_PRESETS` (`scoring-weights.ts:291-352`) matches the
plan's / ADR-24's final tables byte-for-byte:
- Composite (IV/Fund/Tech/Sent/Anly): value 45/35/0/0/20 · deep-value 55/30/0/0/15 ·
  quality 15/55/5/5/20 · growth 0/55/10/15/20 · momentum 0/5/60/25/10 ·
  sentiment 0/10/15/60/15 · analyst 5/15/5/15/60 · income 15/40/0/5/40 — each sums to 100.
- Fundamental (Val/Prof/Grw/Fin/Div): value 55/20/0/20/5 · deep-value 65/15/0/20/0 ·
  quality 10/60/20/10/0 · growth 0/15/70/15/0 · income 10/20/0/15/55 — each sums to 100.
- `balanced` is DERIVED via `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`, not
  hardcoded (`scoring-weights.ts:349-350`).

**(b) Zeros handled correctly — the highest-risk item, verified clean.**
- `normalizeWeights` (`scoring-weights.ts:82-110`): a zeroed dimension in a group whose
  sum is positive yields `0/sum = 0` — no NaN, no error. The `sum <= 0` all-zero fallback
  path (returns defaults) is only reached when the whole group is zero, which no preset is.
- Save gate `sumsTo100` (`scoring-weights.ts:368-371`) checks only the group sum — a
  100-sum group containing zeros passes with no special-casing; `computeGroupTotalState`
  (`scoring-weights-settings-gate.ts:48-60`) adds none.
- `toInputs` renders a `0` correctly: `String(0)` → `"0"` into the text input
  (`settings/page.tsx:54-60`); `toNumbers` parses `"0"` → `0` (gate:21-28).
- No divide-by-zero anywhere a zero-containing preset flows: `weightedFundamentalTotal`
  guards `weightSum <= 0` (`scoring-weights.ts:151-156`); `weightedCompositeTotal` uses
  no division.

**(c) Balanced still derived / house default untouched.** `balanced.composite` /
`.fundamental` remain `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`;
`DEFAULT_SCORING_WEIGHTS` is unchanged (composite 0.25/0.25/0.2/0.15/0.15, fundamental
0.3/0.3/0.2/0.15/0.05). The single-source grep invariant holds — `intrinsicValue: 0.25` /
`valuation: 0.3` appear only in `scoring-weights.ts`. The deep-equals Balanced-derivation
and structural sum-to-100 tests still pass (75/75 in the two weights test files).

**(d) Picker change.** `settings/page.tsx:224-241` renders `presetsForGroup(group)` as a
bordered, hairline-divided (`divide-y divide-line2`) list of full-width `<button>` rows,
each showing `label` + always-visible `blurb` — matching the revised DESIGN.md "Style
preset picker" spec. Populate-only: `onClick` calls `setInputs(toInputs(preset[group]!))`,
issues no PUT, stores no active/selected state. `presetsForGroup` order preserved (9
composite / 6 fundamental). Keyboard/a11y preserved — native `<button>` with
`focus-visible:ring-*`. `settings/loading.tsx:40-50` skeleton updated to the 3-row
label-line/description-line bordered `divide-y` list matching the real row shape.

**(e) Blurb copy.** All nine blurbs rewritten to state what each style optimizes for;
value-locked by unit test. Wording drift vs. the plan's draft list is captured as RTN-I1
above.

**(f) ADR-24.** Present (`DECISIONS.md:175-180`), accurate to the final numbers, records
both governing principles (intrinsicValue DCF-bias grounding + maximize-distinction /
zeros-allowed). The DCF-bias claim was cross-checked against the actual service:
`intrinsic-value.service.ts` caps DCF growth at 15% (`Math.min(earningsGrowth, 0.15)`,
line 117), 10% flat discount (line 132), terminal P/E ~15 (line 122), Graham/multiples
~15 P/E / ~1.5 P/B fallbacks (lines 160/213) — the ADR's grounding for zeroing
`intrinsicValue` on growth/momentum/sentiment is correct. ADR-23 cross-reference is sane
(ADR-23 Status line notes its values are re-derived by ADR-24, mechanism unchanged). Test
value-locks (`scoring-weights.test.ts` "SCORING_STYLE_PRESETS value-lock (ADR-24 retune)")
match the shipped numbers.

## Standing checklist
- Working tree clean — `git status --porcelain` empty (no in-flight STATUS.md this session). PASS.
- STATUS.md within limits — 12 lines, links only, `## In progress` + `## Blocked`, no narrative. PASS.
- File structures conform — ADR-24 matches the ADR template; DECISIONS.md / ARCHITECTURE.md / AGENT.md updates well-formed. PASS.
- Secrets — no keys/tokens in the diff; secret-scan clean. PASS.
- Verify block present and passing — `npm run verify`: typecheck ok · lint ok (no new warnings) · 254/254 tests · secret-scan clean. PASS.
- Test coverage — the retuned values, all zero-containing groups, and all nine blurbs are value-locked; structural (sum-to-100/keys/ids/membership/Balanced-derived) tests retained and green. PASS.

## Proposed DECISIONS.md entries
None — ADR-24 already captures this change accurately.

---

## Iteration 2 — RTN-I1 verification (2026-07-21)

Second-pass review of the fix for RTN-I1, isolated to the changes made since the
iteration-1 review commit (`0d7101db`). Target: branch HEAD `892045c9`. Diff
isolated against the PR base with `git diff plan/scoring-style-presets...HEAD`
and, for the fix specifically, `git diff 0d7101db..HEAD`. PR #24 base
(`plan/scoring-style-presets`) not re-reviewed. Working tree clean at review time
(`git status --porcelain` empty).

### Scope of the iteration-2 change
`git diff 0d7101db..HEAD --stat` shows exactly two files touched since iteration 1:
- `plans/2026-07-21-scoring-style-descriptions-retune.md` — 6 insertions / 6 deletions (the RTN-I1 fix commit `b0c611dd`).
- `STATUS.md` — orchestrator/session bookkeeping only.

No application code, no test, no other doc changed. `lib/utils/scoring-weights.ts`
and `lib/utils/scoring-weights.test.ts` are **byte-identical** since iteration 1
(`git diff 0d7101db..HEAD -- lib/utils/scoring-weights.ts lib/utils/scoring-weights.test.ts`
returns empty). The fix is therefore correctly doc-only and did **not** accidentally
edit the code blurbs or the weights.

### (1) RTN-I1 resolved — all 9 blurbs match byte-exactly
The plan's "Blurb copy" list (lines 267-275) now matches the nine shipped `blurb`
strings in `SCORING_STYLE_PRESETS` (`lib/utils/scoring-weights.ts:295-348`)
character-for-character, including the em-dashes (`—`) in the growth blurb.
Verified by an exact string-by-string comparison keyed on preset id:

| Preset | Match |
|--------|-------|
| value | exact |
| deep-value | exact |
| quality | exact |
| growth | exact (em-dash preserved) |
| momentum | exact |
| sentiment | exact (unchanged both sides) |
| analyst | exact (unchanged both sides) |
| income | exact |
| balanced | exact (unchanged both sides) |

0 mismatches across all 9. The fix commit updated the 6 blurbs that had drifted
(value, deep-value, quality, growth, momentum, income) and left the 3 that already
matched (sentiment, analyst, balanced) untouched — correct.

### (2) No new issue introduced
- The fix commit (`b0c611dd`) touches only the plan markdown; `--stat` confirms no code file in the commit.
- The edited region is a clean bulleted list (lines 267-275), not a markdown table — no table was broken and the list structure is intact and well-formed.
- The surrounding plan prose ("Growth's blurb now emphasizes business compounding…") remains consistent with the shipped growth blurb.
- Commit message correctly notes DECISIONS.md ADR-24 and DESIGN.md reference the blurbs generically without quoting verbatim, so neither needed a change — verified: neither file quotes a blurb string.

### (3) Core retune unchanged since iteration 1 (spot-check)
The weight numbers and derived-Balanced are byte-identical since iteration 1: the
only commit that ever touched `scoring-weights.ts` on this branch is the original
feat commit `df5afd6a` (pre-iteration-1), and the code diff since the iteration-1
review commit is empty. The iteration-1 verifications in sections (a)-(f) above
therefore still hold without re-derivation. `npm run verify` re-run on HEAD:
typecheck ok · lint ok (pre-existing warnings only, per AGENT.md) · **254/254 tests
pass** · secret-scan clean.

### Iteration-2 security pass
Doc-only diff since iteration 1 (plan markdown + STATUS.md); no code, route, auth,
DB, or injection surface touched. The `security-review` skill diffs the working
tree against HEAD and the tree is clean with HEAD already committed, so it has no
meaningful input — skipped per the Reviewer protocol, security pass done manually
against `0d7101db..HEAD`. secret-scan (via `npm run verify`): clean. No security
findings.

### Iteration-2 standing checklist
- Working tree clean — `git status --porcelain` empty. PASS.
- STATUS.md within limits — links only, no narrative, no custom sections. PASS.
- File structures conform — plan blurb list well-formed; no template drift introduced. PASS.
- Secrets — no keys/tokens in the diff; secret-scan clean. PASS.
- Verify block present and passing — `npm run verify` green (254/254). PASS.

**Conclusion:** RTN-I1 resolved, no new findings, core retune unchanged. This
review has 0 open findings. The plan and shipped code now fully agree.
