# Review: full-audit fixes (AUD-01..AUD-10)
Date: 2026-07-17
Status:

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 3 SUGGESTIONs, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: AUD-FIX-01 (ISSUE), AUD-FIX-02..AUD-FIX-04 (SUGGESTIONs)

Scope: review of the implementation on branch `fix/full-audit-findings` (HEAD `d4dda13e`, PR #12) of the ten findings in `reviews/2026-07-17-full-audit.md`. Working tree clean at review time; `npm run verify` passes at HEAD — typecheck ok · lint ok (pre-existing warnings only) · 22/22 tests · secret-scan clean (up from 10/10 pre-branch).

Security pass (self + `security-review` skill as reference): no new vulnerabilities introduced. The refactor is a net security improvement — AUD-06 stops two 500 handlers leaking `error.message`, and AUD-05 removes the self-fetch that carried no session. The new `getAnalyzedNewsForSymbol` path is only ever called from already-authenticated server contexts (the news route still runs its own `getServerSession` + rate-limit guard before delegating; wishlist scoring is reached only through the auth-gated wishlist route), so removing the HTTP hop introduces no auth/user-scoping regression — the extracted data is symbol-keyed shared market data, not user-scoped, so there is nothing to re-scope. Lazy `import('./sentiment.service')` inside `getAnalyzedNewsForSymbol` correctly preserves the AGENT.md fragile-surface contract (sentiment.service throws at import time without `GEMINI_API_KEY`) and is gated behind the `process.env.GEMINI_API_KEY` check, so a keyless caller never triggers the import.

Verdict per finding: AUD-01 ✓, AUD-02 ✓, AUD-03 **partial** (see AUD-FIX-01), AUD-04 ✓, AUD-05 ✓, AUD-06 ✓, AUD-07 ✓, AUD-08 ✓, AUD-09 ✓ (doc-only), AUD-10 ✓. Tests are meaningful, not padding (happy path + edge/failure cases; the wishlist test specifically pins the `?? 5` vs `|| 5` regression, the realized-pl tests cover FIFO exhaustion and zero-cost-basis). Docs (AGENT.md, ARCHITECTURE.md, DECISIONS.md ADR-6, TECH_DEBT.md TD-06/10/12/16, `.env.example`) are all updated consistently and now match code.

## Findings

### AUD-FIX-01 — ISSUE
**File:** app/api/portfolio/positions/[ticker]/sell/route.ts:56-86
**Problem:** AUD-03's stated goal was that `portfolio.realizedPL` (accumulated by the sell route) and the closed-positions "Total realized P/L" reconcile for the same transaction history. They still do not, because the sell route matches each new sell against **all** raw `BUY` transactions (`prisma.transaction.findMany({ where: { positionId, type: "BUY" } })`, line 56) **without netting out quantity already consumed by prior SELLs**. The closed-positions route, by contrast, mutates its `buyLots` array in place and processes sells in chronological order, so lot consumption is cumulative and correct.

Concrete divergence — a position with `BUY 10 @ $100` then `BUY 10 @ $200`, no fees:
- First `SELL 10`: both routes match lot 1 → cost basis $1000. Agree.
- Second `SELL 10` (via the sell route): re-reads the full lot list unchanged, FIFO-matches against lot 1 again → cost basis **$1000**, so `portfolio.realizedPL` accumulates as if both sells came from the cheap lot.
- Same second sell in closed-positions: lot 1 was already consumed by sell 1, so it matches lot 2 → cost basis **$2000**.

The two surfaces disagree by $1000 on that sell — precisely the average-cost-vs-FIFO class of drift AUD-03 set out to eliminate, now re-expressed as FIFO-without-prior-sell-accounting vs true cumulative FIFO. The shared `matchFifoLots` helper is correct; the defect is that the sell route feeds it un-depleted lots. On the very common single-sell-per-position path the two agree, which is why the tests (which never exercise a second sell against the same position) pass — see AUD-FIX-04.
**Recommendation:** Before matching, deplete the lots by all prior SELL quantity for this position. Either (a) load prior `SELL` transactions and run `matchFifoLots(lots, totalPriorSellQty)` once to advance the FIFO cursor before matching the current sell, or (b) reconstruct realized P/L for `portfolio.realizedPL` from the same full-history FIFO pass the closed-positions route uses, rather than per-sell against raw lots. Add a regression test with two sequential sells against a two-lot position asserting the sell route's summed realized P/L equals the closed-positions total (this is the assertion that would have caught it).

### AUD-FIX-02 — SUGGESTION
**File:** app/api/portfolio/positions/route.ts:37-38, 59-61
**Problem:** Two loose ends left by the AUD-02 refactor. (1) `totalCost` (line 37) and `avgCostWithFees` (line 38) are computed before the `if (existingPosition)` branch but are now only consumed by the new-position `else` branch — in the existing-position path they are dead. Harmless but misleading, since the values no longer describe what that branch does. (2) After `applyBuyToPosition` runs inside `prisma.$transaction`, the route issues a second `prisma.position.findUnique` (line 59) **outside** the transaction purely to return the updated row. This is a correct read-after-commit (not a correctness bug), but `applyBuyToPosition` already has the fully-updated position state in hand; returning it from the service (or reading inside `tx`) would save a round-trip and remove the "why is there a second query" question for the next reader.
**Recommendation:** Move `totalCost`/`avgCostWithFees` into the `else` branch where they are used. Optionally have `applyBuyToPosition` return the updated position so the trailing `findUnique` can be dropped.

### AUD-FIX-03 — SUGGESTION
**File:** app/api/portfolio/closed-positions/route.ts:135-142, app/api/portfolio/positions/[ticker]/sell/route.ts:74-79
**Problem:** Both routes handle an unmatched FIFO remainder (a sell that exceeds available buy lots — a data inconsistency) by falling back to `position.avgCostBasis` for the unmatched quantity and logging a `console.warn`. This is a reasonable non-silent choice and a clear improvement over AUD-04's old silent `continue`/drop. But the two fallbacks are now a *third* small piece of duplicated accounting logic living outside `realized-pl.service.ts` (`unmatchedQuantity.mul(position.avgCostBasis)` in both files), which is the same duplication-drift risk AUD-02/AUD-03 were extracted to remove. Also, `closed-positions:139` divides `totalCostBasis` by `sell.quantity` for the displayed `avgCostBasis` — fine as long as `sell.quantity > 0`, which the sell path guarantees via zod but the closed-positions path reads straight from persisted rows (a zero-quantity SELL row, if one ever existed, would produce `Infinity`); low likelihood, worth a guard.
**Recommendation:** Consider folding the avg-cost-basis fallback into a shared helper in `realized-pl.service.ts` so all three consumers stay consistent. Guard the `avgCostBasis` division against a zero divisor in the closed-positions route.

### AUD-FIX-04 — SUGGESTION
**File:** lib/services/realized-pl.service.test.ts
**Problem:** The new unit tests for `matchFifoLots`/`calculateRealizedPL` are genuinely meaningful (FIFO ordering, fee proration, exhaustion/unmatched reporting per AUD-04, zero-cost-basis guard, loss case) — not padding. But they test the *helper* in isolation and never exercise the two-routes-must-agree property that AUD-03 exists to guarantee, nor a second sell consuming later lots. That coverage gap is exactly what let AUD-FIX-01 through: a test asserting "sell route summed realized P/L == closed-positions total for a multi-sell, multi-lot history" would fail today.
**Recommendation:** Add a reconciliation-style test (can stay at the helper level by simulating the sell route's per-sell matching against fresh un-depleted lots vs the closed-positions cumulative matching, and asserting they must be equal — it will fail until AUD-FIX-01 is fixed, which is the point).

## Proposed DECISIONS.md entries

None — no new architectural decisions surfaced. AUD-FIX-01 is a correctness gap in implementing an already-accepted finding, not a new decision.
