# Review: Morning note covers only current holdings (drop closed positions)
Date: 2026-07-22
Status:

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: MRN-S1 (optional)

Scope reviewed: branch `feature/morning-note-active-positions-only` HEAD (`6271fcba`)
against `main`. Implements `plans/2026-07-22-morning-note-active-positions-only.md`.
Diff is one production-code line-group (`app/api/insights/portfolio/route.ts`),
one new test file, and doc/plan updates.

The implementation is correct, minimal, and matches the plan exactly. The fix
adds `where: { quantity: { gt: 0 } }` to the insights route's `positions`
include, mirroring the established convention in `app/api/portfolio/route.ts:19-24`.
Verify block passes in full (typecheck ok · lint ok, pre-existing warnings only ·
257/257 tests · secret-scan clean). No BLOCKERs or QUESTIONs — this is clear for
merge on the owner's sign-off.

### Steps performed
- **Security pass** (Step 1): the change is a Prisma `where` filter with a
  hardcoded literal (`gt: 0`); no user input reaches it, `userId` scoping is
  unchanged and session-derived, Prisma parameterizes the query. Position tickers
  flow into a Gemini prompt but that is an AI-prompt data path with no injection
  sink (and is out of scope for the security skill's exclusions). No secrets, no
  auth change, no new attack surface. No findings.
- **Correctness pass** (Step 2): verified below.
- **Doc drift + test coverage** (Step 3): verified below.
- **Standing checklist** (Step 4): verified below.

## Findings

### MRN-S1 — SUGGESTION
**File:** `app/api/insights/portfolio/route.test.ts:147-161`
**Problem:** The empty-portfolio test (case b) uses
`findUniqueMock.mockImplementationOnce(async () => ({ ... positions: [] }))`,
returning an already-empty array directly rather than driving the empty result
*through* the honoured filter. It therefore asserts the `positions.length === 0`
short-circuit but not that a portfolio whose only rows are `quantity: 0` actually
filters down to empty. The two happy-path tests already assert the filter is
passed and honoured (`gt: 0`, ARGX excluded), so the overall coverage of the
regression is adequate — this is a small gap in that one case, not a correctness
defect.
**Recommendation:** Optional. Replace the `mockImplementationOnce` override in
case (b) with input relying on the default `findUniqueMock` (which honours the
`where` clause) but seeded with only a `quantity: 0` position, so the empty set
is produced by the filter under test rather than hand-supplied. Leaves the same
assertions in place. Purely a robustness improvement; no behavior change.

## Detail — correctness (Step 2)

- **The filter.** `app/api/insights/portfolio/route.ts:14-24` adds
  `include: { positions: { where: { quantity: { gt: 0 } } } }`, an exact mirror of
  `app/api/portfolio/route.ts:19-24` (the reference `orderBy: { marketValue }` is
  correctly omitted — the insights route consumes only `positions.map(p => p.ticker)`,
  so ordering is irrelevant). Filtering at the query rather than post-fetch is the
  right call: `Position.quantity` is a Prisma `Decimal`, and a JS `p.quantity > 0`
  comparison on a Decimal object is a documented footgun the query-level filter
  avoids. Correct.
- **Empty-portfolio branch.** `positions = portfolio?.positions || []` (line 44);
  when every remaining row is `quantity: 0`, the DB returns an empty array, so
  `positions.length === 0` (line 46) fires and returns the "No positions in
  portfolio to analyze" response before any Gemini call. This is exactly the
  fully-exited-portfolio behavior the plan intends. Correct.
- **Cache interaction.** Insights are cached per user per day (`userId_date`);
  a note generated earlier today that already names a closed ticker is served from
  cache until tomorrow. The plan documents this as an accepted assumption (no
  backfill/purge in scope) — consistent with the guardrail against clearing
  persisted data. Not a defect.
- **Regression test quality.** The prisma mock genuinely honours
  `include.positions.where.quantity.gt`, so removing the route's filter makes the
  `minQty === undefined` branch return both AAPL and ARGX — which breaks test 1's
  `callArgs.include.positions.where.quantity.gt` assertion (undefined access) and
  test 2's `not.toContain("ARGX")`. The test therefore genuinely fails if the
  filter is removed (plan Task 2 acceptance met). Network is fully mocked
  (`@google/generative-ai` + prisma), so no real Gemini/DB call occurs. Assertions
  target the prompt ticker set and the empty-portfolio short-circuit, not model
  output. Sound.

## Detail — doc drift + test coverage (Step 3)

- **PRODUCT.md** — the daily-insight bullet now reads "Covers current holdings
  only — a fully-sold (closed) position is excluded from the prompt." Matches the
  implemented behavior. Accurate.
- **AGENT.md** — new fragile-surface entry names the `quantity: { gt: 0 }`
  invariant for "current holdings" reads of `portfolio.positions`, cites the
  reference route and the regressed route, and cross-references ADR-18. Matches
  code. Accurate, no drift.
- **Test coverage** — the one new/modified route now has a dedicated test file
  (previously none). Happy path (held ticker included, closed excluded) and the
  meaningful edge case (fully-exited portfolio → no Gemini call) are both covered.
  Adequate per the meaningful-coverage bar. MRN-S1 above is the only (optional)
  refinement.

## Detail — standing checklist (Step 4)

- **Working tree clean** — `git status --porcelain` empty at review time; STATUS.md
  is already committed (`6271fcba`), so the pipeline STATUS.md carve-out did not
  need to apply. Pass.
- **STATUS.md within limits** — 13 lines, links only, `In progress` + `Blocked`
  sections only, no narrative/custom sections. Pass.
- **Template conformance** — plan file matches the Plan structure; `plans/INDEX.md`
  row present with Status `in review`; `PortfolioInsight` unchanged. Pass.
- **Secrets** — secret-scan step of the Verify block passes; no keys/tokens in the
  diff. Pass.
- **Verify block present and runnable** — `npm run verify` ran green end to end
  (typecheck · lint · 257/257 tests · secret-scan). Pass.

## Proposed DECISIONS.md entries
None. Per the plan (Task 3), this is a bug fix applying an already-decided
convention (ADR-5 retained-rows model / ADR-18), not a new decision — no new ADR
is warranted. Concur.
