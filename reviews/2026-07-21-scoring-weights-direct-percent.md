# Review: Scoring weights — direct whole percentages summing to 100 (ADR-22 revision)
Date: 2026-07-21
Status:

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 1 SUGGESTION, 1 QUESTION
Requires owner decision: DP-Q1 (doc-drift on migration-applied status — confirm live state)
Ready for Coding agent: DP-I1 (meta-kicker scale-mismatch bug), DP-S1 (optional over-100 rounding test)

Scope: this reviews ONLY the direct-percent delta (commit `4d7828cd` plus the plan/design/chore
commits after the prior review `4af018e5`) on branch `feature/configurable-scoring-weights` / PR #22.
The underlying configurable-scoring-weights feature was reviewed separately in
`reviews/2026-07-20-configurable-scoring-weights.md` and is not re-reviewed here.

The load-bearing guarantees hold and are concretely verified (see below). The one real defect is a
presentational scale-mismatch (DP-I1): the GET endpoint's response scale changed from raw-fractions
to whole-percents, but two client consumers that compare that response against the fraction-scaled
`DEFAULT_SCORING_WEIGHTS` for the "Your weighting" meta-kicker were left unchanged, so the kicker now
shows for every user — including default users. Scoring itself is unaffected.

### Verified clean (the two real-risk spots + the guarantees)
- **(A) Scale-invariance / scoring byte-identical — VERIFIED.** `normalizeWeights`,
  `weightedCompositeTotal`, `weightedFundamentalTotal`, `weightsEqualDefaults`, and
  `DEFAULT_SCORING_WEIGHTS` are untouched vs. the prior-review base (`git diff 4af018e5..HEAD --
  lib/utils/scoring-weights.ts` shows only doc-comment additions to those symbols' region, no logic).
  The scoring consumers `components/overview.tsx`, `components/fundamental-analysis.tsx`,
  `lib/services/fundamental-analysis.service.ts`, `lib/services/wishlist.service.ts`, and
  `app/api/market/fundamentals/**` are all unchanged in the delta. The Task-2 regression block
  (`lib/utils/scoring-weights.test.ts:285-326`) genuinely asserts identity: percent group
  `{25,25,20,15,15}` vs. fraction `{0.25,…}` produce the same `weightedCompositeTotal`; same for
  fundamental; and an arbitrary legacy raw row `{2,2,1.6,1.2,1.2}` scores identically to its
  `fractionsToPercents(normalize(...))` presentation.
- **(B) Largest-remainder rounding — VERIFIED.** `fractionsToPercents`
  (`lib/utils/scoring-weights.ts:192-221`) floors every scaled value, computes `leftover = 100 -
  sum(floors)`, and distributes it one point at a time to the largest fractional remainders (stable
  tie-break). The equal-thirds drift case is genuinely tested (`scoring-weights.test.ts:223-231`):
  `{1/3,1/3,1/3}` → `[33,33,34]` summing to exactly 100, not the naive 99. Under-100 (round-down)
  drift is repaired by the `leftover > 0` loop; the over-100 (round-up) case has a defensive
  `leftover < 0` trim loop — correct, though for normalized inputs summing to ~1.0 the sum-of-floors
  can never exceed 100, so that branch is defensive-only (see DP-S1).
- **(C) Validation contract — VERIFIED.** `validateGroup`
  (`scoring-preferences.service.ts:131-158`) requires all 5 keys present, each finite and in
  `[0,100]`, and `sumsTo100` (epsilon 0.01); the old ADR-20 partial-merge is dropped (partial group
  → 400). Tests cover sum=94 reject, sum=101 reject, `-1` reject, `121` reject, missing-key reject,
  NaN/Infinity reject, and valid-100 accept, each asserting `upsert` is not called on rejection
  (`scoring-preferences.service.test.ts:222-261`).
- **(D) Two-accessor split — VERIFIED.** `getWeights` (raw-coalesced) is unchanged and is what the
  scoring consumers use; `getWeightsForSettings` (normalize → `fractionsToPercents`) is called only by
  the settings route GET (`grep` confirms no other caller). Caveat folded into DP-I1: the client
  consumers fetch from `/api/settings/scoring-weights`, which now returns the percent form — safe for
  the *scoring* path (they re-normalize) but not for the equality-based meta-kicker.
- **(E) Single source of truth — VERIFIED.** `grep -rn "intrinsicValue:\s*0\.25\|valuation:\s*0\.3"`
  (excluding tests) hits only `lib/utils/scoring-weights.ts`. The new gate module
  `lib/utils/scoring-weights-settings-gate.ts` defines no weights — pure total/validity/gate logic.
- **(F) Settings page UX — VERIFIED (static + gate test).** Normalized-% band removed; group-total
  status line present (`--mut` valid / `--dn` invalid, `page.tsx:214-221`); Save gated on
  `isValid && isDirty` via `computeGroupTotalState`; `%` label suffix per field; Reset sets
  `fractionsToPercents(DEFAULT_...)`. Gate logic fully unit-tested
  (`scoring-weights-settings-gate.test.ts`: short/over disabled, 100+dirty enabled, pristine disabled,
  reset yields valid+dirty). Coding agent's live Playwright verification (179% → invalid + Save
  disabled; 100% → enabled; save persists) is strong corroboration for the settings page itself —
  but see DP-I1: it did not exercise the Overview/Fundamental meta-kicker, which is where the bug
  surfaces.
- **(G) No new migration / schema unchanged — VERIFIED.** `git diff 4af018e5..HEAD -- prisma/` is
  empty. Same `Float` columns; only the stored number's scale changes in code.
- **Security — VERIFIED, no regression.** The `security-review` skill run over the delta surfaced no
  findings. The PUT/GET route derives `userId` from the session via `getAuthenticatedUser()` (unchanged
  from the prior review — IDOR-safe; a user can only read/write their own prefs row keyed by
  session `userId`). The stricter validation (`[0,100]` + sum-to-100) narrows the accepted input set;
  it introduces no bypass and no new injection surface (all inputs are coerced to `number`, stored via
  parameterized Prisma `upsert`). Invalid JSON is caught and returns 400. Non-`InvalidScoringWeightsError`
  failures return a generic 500 without leaking internals.
- **Verify block — PASSES.** `npm run verify` green: typecheck ok, lint ok (pre-existing non-failing
  warnings only), 224/224 tests, secret-scan `no leaks found`. Matches the reported 224/224.

## Findings

### DP-I1 — ISSUE
**File:** `components/overview.tsx:181`, `components/fundamental-analysis.tsx:81`
**Problem:** The "Your weighting" custom-weighting meta-kicker is derived by comparing the
`["scoring-weights"]` GET response against the fraction-scaled `DEFAULT_SCORING_WEIGHTS` with
exact-equality (`weightsEqualDefaults`). Before this delta, GET returned raw fractions, so a default
user's row came back as `{intrinsicValue: 0.25, …}` and `weightsEqualDefaults(data, DEFAULTS)`
returned `true` → kicker hidden (correct). This delta changed GET to return **whole percents** via
`getWeightsForSettings` (`{intrinsicValue: 25, …}`), but these two consumers were **not** updated —
the plan explicitly listed them as "NOT modified (scale-invariance)". That reasoning holds for the
*scoring math* (both re-normalize the fetched weights, so `compositeWeights` and the score are
correct) but **not** for the scale-*sensitive* exact-equality comparison. Now
`weightsEqualDefaults({25,25,20,15,15}, {0.25,0.25,0.2,0.15,0.15})` returns `false` for a default
user, so `hasCustomWeights` is `true` and the personalized-weighting meta-kicker renders for **every**
user, including those who never touched Settings. The scores shown are still correct; the kicker label
is wrong. The coding agent's live-verify covered the settings page (179%/100% gating) but not the
Overview/Fundamental tabs, so this was not caught.
**Recommendation:** Make the meta-kicker comparison scale-agnostic. Either (a) normalize both sides
before comparing — compare `normalizeCompositeWeights(weightsQ.data?.composite)` against
`DEFAULT_SCORING_WEIGHTS.composite` (already normalized) with a tolerance, since exact float equality
after ÷sum is fragile; or (b) convert the defaults to percents for the comparison
(`weightsEqualDefaults(weightsQ.data?.composite, fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite))`),
mirroring what the settings page already does with `DEFAULT_COMPOSITE_PERCENTS`. Option (a) is more
robust (immune to any future scale change). Add a test asserting a default-percent group
(`{25,25,20,15,15}`) yields `hasCustomWeights === false` and a genuinely-custom split yields `true`,
so this specific regression cannot recur silently.

### DP-S1 — SUGGESTION
**File:** `lib/utils/scoring-weights.test.ts:198-242`
**Problem:** `fractionsToPercents`'s under-100 (round-down) drift repair is well covered (equal-thirds
→ `[33,33,34]`). The symmetric over-100 (round-up) case — where `sum(floors)` could in principle
exceed 100 and the `leftover < 0` trim loop fires — has no direct test. In practice this branch is
unreachable for the only real caller (`getWeightsForSettings` always passes a normalized group summing
to ~1.0, so `sum(floors) ≤ 100`), which is why this is a SUGGESTION, not an ISSUE.
**Recommendation:** Optionally add a test that drives the negative-leftover trim path directly (e.g. a
hand-constructed group whose ×100 floors sum to 101) to lock in the defensive branch's behavior, or
add a one-line comment noting the branch is defensive-only and unreachable for normalized inputs.

### DP-Q1 — QUESTION
**File:** `STATUS.md`, `DECISIONS.md` ADR-22 (`:165`), `ARCHITECTURE.md` (`:29`), commit `4d7828cd` message
**Problem:** The commit message for the feature states "Live-verified against the **applied**
UserScoringPreferences migration," and the review task states the owner-gated migration was applied
this session. However, ADR-22's Status line, the ARCHITECTURE.md `UserScoringPreferences` entry, and
the AGENT.md fragile-surface note all still assert the migration `20260720220007_user_scoring_preferences`
"remains owner-gated and unapplied" / "GET/PUT … will fail against the live database until the owner
runs `prisma migrate deploy`." If the migration is in fact now applied and the feature is live, these
three docs are stale (doc-vs-code drift) and should be updated to reflect the applied state; if it is
NOT applied, the commit message's live-verify claim is inaccurate. This is an owner-confirmable factual
question about environment state, not a code defect.
**Recommendation:** Owner to confirm whether `prisma migrate deploy` has been run for this table. If
applied: update ADR-22 Status, the ARCHITECTURE.md line, and the AGENT.md entry to drop the
"unapplied / will fail" language (and clear the prior review's SCW-Q1 pending item). If not applied:
the commit's "applied migration" live-verify claim should be corrected in the record.

## Proposed DECISIONS.md entries
None — ADR-22 already exists and accurately documents the direct-percent model, the scale-invariance
rationale, the two-accessor split, and the gate-module extraction. No new ADR is warranted; DP-I1 is a
straightforward bug fix within the existing ADR-22 model (the fix should keep the meta-kicker faithful
to ADR-22's "consumers unchanged" intent by making the comparison scale-agnostic, not by changing the
scoring scale).
