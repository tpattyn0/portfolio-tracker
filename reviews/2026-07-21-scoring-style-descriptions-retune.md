# Review: scoring-style descriptions + signal-diagnostic weight retune
Date: 2026-07-21
Status:

## Summary
Findings: [0 BLOCKERs, 1 ISSUE, 0 SUGGESTIONs, 0 QUESTIONs]
Requires owner decision: none
Ready for Coding agent: RTN-I1

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

### RTN-I1 — ISSUE
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
