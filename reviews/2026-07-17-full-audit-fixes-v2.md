# Review: full-audit fixes v2 (AUD-FIX-01..03 implementation)
Date: 2026-07-17
Status: IMPLEMENTED — 2026-07-17 (REV2-01 fixed inline by the Reviewer session; REV2-02 accepted as no-action-needed)

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: REV2-01 (ISSUE), REV2-02 (SUGGESTION)

Scope: review of branch `fix/full-audit-findings` HEAD `5eaa81da`, which implements the three findings from `reviews/2026-07-17-full-audit-fixes.md` (AUD-FIX-01 ISSUE, AUD-FIX-02/03/04 SUGGESTIONs) against `reviews/2026-07-17-full-audit.md`'s original AUD-03. Working tree clean at review time. `npm run verify` passes: typecheck ok, lint ok (pre-existing warnings only, none new), 28/28 tests (up from 22/22 at the prior review — 6 new tests), secret-scan clean.

## Security pass

Ran a targeted security analysis (dedicated sub-review, standing in for the `security-review` skill run against this diff — the skill's own harness diffed the full PR range rather than just this session's new commit, so the analysis was scoped manually instead) against `553e948f..5eaa81da`: the new prior-SELL query in `sell/route.ts` (`prisma.transaction.findMany({ where: { positionId: position.id, type: "SELL" }, ... })`), the `resolveCostBasisWithFallback` extraction, the `closed-positions` zero-quantity guard, and the `applyBuyToPosition`/`positions/route.ts` redundant-query removal.

Findings: none at high confidence.
- `positionId` in the new prior-sells query is `position.id`, sourced from the `prisma.position.findUnique` a few lines above that is already scoped by the `portfolioId_ticker` compound key using the authenticated user's own `portfolio.id` (`getAuthenticatedUserWithPortfolio()`). No unvalidated input reaches the new query — no cross-user or cross-position leakage.
- Removing the trailing `prisma.position.findUnique` in `positions/route.ts` and returning `result.position` (the same `tx.position.update` result) instead is not an authorization change — same row, same transaction, no new read path.
- No raw SQL introduced anywhere in this diff; all Prisma query-builder calls.
- The new `console.warn` calls (`resolveCostBasisWithFallback`) interpolate only ticker, quantity, and a caller-supplied context string ("Sell of X TICKER" / "Position ID: couldn't match N sold shares") — no secrets, tokens, or other users' data.

This refactor is security-neutral: it changes financial arithmetic and query shape, not the auth/ownership boundary, which is untouched by this diff.

## Correctness pass

**AUD-FIX-01 (the main fix) — independently verified, not just trusted via the new tests.** Wrote a throwaway comparison script (`scratch/compare-fifo.test.ts`, run via `npx vitest run`, deleted after use — `scratch/` is gitignored) that simulates both code paths against the same synthetic transaction history: 3 BUY lots (10@100, 20@110, 15@120, distinct fees) and 3 SELLs (12, 15, 20 shares — the third exceeds the 18 shares remaining, deliberately exercising the unmatched-remainder fallback too).

- **Method A** (closed-positions style): one mutable `lots` array, `matchFifoLots` called once per sell in chronological order, cumulative depletion carried forward automatically by array mutation.
- **Method B** (sell-route style, mirroring `sell/route.ts:65-94`): for sell *i*, rebuild a fresh lot array, replay `matchFifoLots` for sells `0..i-1` (discarding the result, purely to advance the depletion state), then match sell *i*.

Result: `totalCostBasis`, `unmatchedQuantity`, and `realizedPL` were bit-for-bit identical between the two methods for all three sells, including the one that hit the average-cost fallback (sell 3: both methods report `totalCostBasis=2368.0000`, `unmatched=2.0000`, `realizedPL=627.0000`). This confirms the two lot-depletion strategies are mathematically equivalent, not just equal on the specific 2-lot/2-sell case the shipped tests cover.

One edge case worth noting for future readers (not a defect — verified it degrades safely): if a *prior* sell itself had an unmatched remainder (i.e., it oversold against available lots), replaying it via `matchFifoLots` still correctly drains every lot to `0` regardless of whether its own `remaining` fully cleared — `matchFifoLots` mutates lot quantities down to the matched portion unconditionally. So the sell route's reconstructed state after replay is identical to what closed-positions' single pass would show at that point (all lots exhausted), even in the oversold-prior-sell case. This isn't tested directly, but follows from reading `matchFifoLots`'s loop (`realized-pl.service.ts:41-59`) — it never leaves a lot's `quantity` un-decremented just because the sell wasn't fully covered.

Also confirmed: the sell route's new `priorSellTransactions` query runs in `Promise.all` alongside the `buyTransactions` query (`sell/route.ts:65-74`), both executed *before* the new SELL row is inserted inside the later `$transaction` block (lines 104+) — so `priorSellTransactions` can never include the sell currently being processed. No off-by-one risk of a sell "seeing itself" as a prior sell.

**AUD-FIX-02 (position.service.ts / positions/route.ts) — correct.** `applyBuyToPosition` now returns the `tx.position.update` result (`position.service.ts:86-101`) instead of discarding it, and `positions/route.ts:53-61` uses `result.position` instead of issuing a second `prisma.position.findUnique` outside the transaction. This is a straightforward "return what you already computed" simplification — the returned row is the exact same write the old code re-read, just without the extra round-trip. The dead `totalCost`/`avgCostWithFees` computation was correctly moved into the `else` (new-position) branch where those variables are actually used (`positions/route.ts:56-58`) — confirmed by reading the diff, they were unreferenced in the `existingPosition` branch both before and after.

**AUD-FIX-03 (resolveCostBasisWithFallback + zero-quantity guard) — correct.** The extracted helper (`realized-pl.service.ts:79-94`) is a faithful lift of the previously-duplicated inline logic in both routes — same `unmatchedQuantity.gt(0)` branch, same `unmatchedQuantity.mul(avgCostBasis)` fallback math, same warn-then-continue behavior, parameterized only by a `context` string for the log message (verified both call sites pass distinct, non-overlapping context strings so a warning is traceable to its origin route). The `closed-positions/route.ts:140-142` zero-quantity guard (`sellQuantity.gt(0) ? Number(totalCostBasis.dividedBy(sellQuantity)) : 0`) directly closes the `Infinity`-on-zero-quantity-sell gap AUD-FIX-03 flagged; the sell route doesn't need the equivalent guard since `sellSchema` already enforces `quantity: z.number().positive()` before any division occurs.

No logic errors found in any of the three fixes.

## Doc drift and test coverage

- **AGENT.md fragile-surface entries match the code.** The new `app/api/portfolio/positions/[ticker]/sell/route.ts` entry (AGENT.md, added this session) accurately describes the replay-prior-sells mechanism and correctly attributes the "gets it for free" contrast with closed-positions' single cumulative pass — this matches what I verified above. The updated `lib/services/realized-pl.service.ts` entry correctly documents `resolveCostBasisWithFallback` and the "call once per prior sell, then once for the new sell" pattern. No drift found between these entries and actual code behavior.
- **Tests are meaningful, not padding.**
  - `sell/route.test.ts` drives the real `POST` route handler (not a simulation) through two sequential sells against a mocked-but-stateful Prisma layer that persists the first sell's SELL transaction and updated `portfolio.realizedPL` before the second call — so it genuinely exercises the accumulation path end-to-end, including the `Promise.all` prior-sells query. Assertions are pinned to specific numbers (1500, then 500, then accumulated 2000) rather than loosely checking "some non-zero value," and the code comment explicitly explains what a regression (lot-1 reuse) would look like (1500 again instead of 500).
  - `realized-pl.service.test.ts`'s new `resolveCostBasisWithFallback` and `sell route vs closed-positions reconciliation` describe blocks independently reimplement both code paths (`closedPositionsTotal` / `sellRouteTotal` helpers) against a shared `buildBuyLots()` fixture and assert they numerically agree — including a third case (5, 10, 10 sold against 20 available) that deliberately spans an unmatched remainder. This is the same style of independent cross-check I ran manually in `scratch/`, and it reaches the same conclusion. Not implementation-mirroring: the two helper functions model the two *routes'* strategies (single cumulative pass vs. fresh-array-replay), not the `matchFifoLots` internals, so a regression in either route's reconstruction approach — not just in the shared helper — would be caught.
  - No coverage gaps identified for this diff. (Pre-existing gaps such as full end-to-end route coverage for `closed-positions/route.ts` itself remain out of scope for this session, per `AGENT.md`'s testing guidance to test only code touched.)

## Findings

### REV2-01 — ISSUE
**File:** STATUS.md
**Problem:** `STATUS.md` still points at the prior review cycle — `Review: reviews/2026-07-17-full-audit.md`, `Next: owner review/merge, then a Reviewer pass to stamp Status: IMPLEMENTED`. It was last updated at commit `d4dda13e`, before the `553e948f` review (which found AUD-FIX-01 as an ISSUE) and before this session's `5eaa81da` fix commit. It does not reflect that: (a) a second review cycle happened and found a real defect, (b) that defect is now fixed on the same branch, and (c) this review file (`2026-07-17-full-audit-fixes-v2.md`) is now the one gating `Status: IMPLEMENTED`. Per CLAUDE.md, `STATUS.md` "records what is in flight" — an owner or the next agent reading it would follow a stale trail (the old review file) instead of this one.
**Recommendation:** Update `STATUS.md`'s `## In progress` block to point at `reviews/2026-07-17-full-audit-fixes-v2.md` and set `Next` to reflect that this is now the review gating the PR merge / `Status: IMPLEMENTED` stamp. This is a doc-only fix — safe to act on autonomously.

### REV2-02 — SUGGESTION
**File:** app/api/portfolio/positions/[ticker]/sell/route.ts:65-87
**Problem:** The replay-prior-sells loop runs `matchFifoLots(lots, ...)` once per prior sell, each a synchronous call, which is fine today but means the route's cost scales linearly with the number of prior sells on a position (not the diff's fault — it's inherent to "re-derive full history on every call," already called out as a known tradeoff in the AGENT.md fragile-surface entry this session added). No action needed now; flagging only so it's visible next to the accepted design tradeoff, in case a position ever accumulates enough sells (dozens+) for this to matter. Not a correctness issue — purely a scaling note that's already implicitly accepted by the "closed-positions route gets this for free... the sell route re-derives lot state from scratch on every call" language already in AGENT.md.
**Recommendation:** No fix required now. If this ever becomes a real cost (very high sell-count positions), consider persisting a lot-depletion cursor instead of full replay — out of scope for this session.

## Proposed DECISIONS.md entries

None — no new architectural decisions surfaced. This review confirms an already-accepted fix (AUD-FIX-01) is implemented correctly; no new tradeoffs were introduced.
