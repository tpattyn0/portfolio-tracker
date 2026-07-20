# Review: research-tab-fixes (Analyst / Intrinsic / Positions / News — 9-item batch)
Date: 2026-07-20
Status: IMPLEMENTED — 2026-07-20

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 2 QUESTIONs
Requires owner decision: RTF-Q1, RTF-Q2 (both owner-acceptance only — no code change gated on them)
Ready for Coding agent: none

Reviewed branch HEAD of `fix/research-tab-fixes` against `origin/main...HEAD` (whole 9-item batch, branch cut fresh off main — no unrelated work in the delta). Working tree clean. `npm run verify` green: typecheck ok · lint ok (pre-existing warnings only, none new) · 122/122 tests · secret-scan clean. Owner resolutions OD-1 (honest relabel), OD-2 (method-spread Bear/Bull), OD-3 (plumb revisions non-persisted, no DB migration) are all reflected faithfully in the implementation.

The two subtle correctness risks called out for this review were verified concretely and are **correct**:
- **Bear ≤ Base ≤ Bull is mathematically guaranteed.** `calculateWeightedAverage` (intrinsic-value.service.ts:270-276) and `calculateScenarioRange` (:294-296) filter on the **identical** predicate `value !== null && value > 0`. The base is therefore a weighted average over exactly the same value set the min/max spans — and a weighted average of a set always lies within `[min, max]` of that set. No weight can push it outside the raw range. Ordering holds whenever ≥2 methods are valid; <2 valid → `scenarioLow`/`scenarioHigh` null (em-dash), no crash.
- **Positions-tab `quantity > 0` gating is preserved byte-for-byte** through the card wrap (transactions-tab.tsx): three-way `getPositionsPanelState`, 4-vs-5-col `hasRealizedPL` band, Realized P/L shown in both held and closed but never re-gated on quantity, "none" empty state unchanged (ADR-18 / PT-I1). The standalone "Your position" kicker is gone; "Position" now sits in the card header.

This is a clean batch. No code findings. The only open items are owner-acceptance checks (live-Yahoo data population and per-tab visual states), which have no Playwright coverage in this repo — consistent with how prior research-detail passes were closed.

## Findings

### RTF-Q1 — QUESTION
**File:** `components/analyst-ratings.tsx:151-175`, `components/intrinsic-value.tsx:113-155`, `components/research/transactions-tab.tsx`, `app/(dashboard)/portfolio/[ticker]/page.tsx` (News tab)
**Problem:** The static + unit-level verification confirms the data *mapping* and *math* are correct, but the actual rendered per-tab visual states against live Yahoo data cannot be verified in-repo — there is no Playwright/E2E harness here (same gap noted in ADR-11/ADR-17 and prior research-detail reviews). Specifically unverifiable by static read: that a real symbol (e.g. AAPL) populates Low/High targets and the revisions table on a fresh fetch; that Bear/Base/Bull render three real figures with the "Lowest/Highest of N methods" captions; that the Positions card renders correctly in held vs closed vs none; that the News tab now reads as a single `NewsFeed` lead-in with the old `SentimentScore` box gone.
**Recommendation:** Owner to visually accept the four tabs against at least one well-covered symbol and one thin-coverage symbol (e.g. AAPL + ENGI.PA), confirming: real Low/High + revisions on Analysts; three Bear/Base/Bull figures on Intrinsic; correct Positions card state for a held, a fully-sold, and a never-held symbol; single-card News tab. No code change is expected — this is acceptance sign-off, not a fix.

### RTF-Q2 — QUESTION
**File:** `lib/services/analyst-ratings.service.ts:215-234` (`formatCachedData`), `TECH_DEBT.md` TD-DTL-REV2, `AGENT.md` fragile-surface entry
**Problem:** `targetLowPrice`/`targetHighPrice`/`revisions` are deliberately non-persisted (OD-3/A4) — present on a fresh Yahoo fetch, `null`/`[]` on a 24h `AnalystRating` cache hit, because no DB columns exist for them. This is intentional and correctly documented (TD-DTL-REV2, AGENT.md, unit-tested at analyst-ratings.service.test.ts:151-173). The user-visible consequence is that these three fields silently blank out for up to 24h after the first fetch on any symbol, even though a prior fresh fetch had them. Flagging so the owner confirms this acceptance is still current (it was already accepted at plan time to avoid a shared dev/prod migration per ADR-6/ADR-14).
**Recommendation:** Owner to confirm the non-persisted-on-cache-hit tradeoff remains acceptable. If the intermittent blanking is judged too surprising in practice, closing it requires the owner-signed-off `AnalystRating` migration already scoped in TD-DTL-REV2 (add `targetLowPrice`/`targetHighPrice` columns + a `revisions` Json column, populate in `saveToDatabase`). No action unless the owner elects to close TD-DTL-REV2.

## Notes (verified clean — no finding)
- **Security pass (Step 1, folded in):** no HIGH/MEDIUM security issues. Auth guard + rate limit + parameterized Prisma preserved on the intrinsic-value route; `extractRevisions` coerces every field via `String(...)` / `new Date(...).toISOString()` and filters malformed entries (firm/action/epochGradeDate required) before mapping; no injection surface, no secrets, no `dangerouslySetInnerHTML`. The `sentiment-score.tsx` deletion removes a render surface only — grep confirms **no remaining importer** of the `SentimentScore` component (the two grep hits are an unrelated comment in `overview.tsx` and a differently-named `calculateSentimentScore` in `wishlist.service.ts`).
- **Task 1 (buy bar):** `bg-up/70`→`bg-up`, `bg-dn/70`→`bg-dn` on the Buy/Sell distribution rows; no other row's color changed; width math (`count/total*100`) untouched.
- **Task 2 (Low/High):** `targetLowPrice`/`targetHighPrice` null-coalesced (`?? null`), rendered with em-dash fallback; cache-hit returns `null` (not `undefined`/`NaN`). Tests assert present + absent→null.
- **Task 3 (revisions):** `extractRevisions` handles absent `upgradeDowngradeHistory`/`.history` via optional chaining + `Array.isArray` guard (no crash); empty→reworded empty state; tests cover populated + empty + cache-hit `[]`.
- **Tasks 4/5 (Intrinsic relabel):** assumptions rows trace to real `dcfLite.inputs.growthRate`/`terminalPE`/`discountRate`; old "Revenue growth" mislabel gone; "FCF margin" / "Terminal growth" rows removed (dropped, not permanent em-dash) — matches OD-1 and the AGENT.md guard.
- **Task 6 (scenario math):** consistent method set for base and spread (see Summary); tests assert `scenarioLow ≤ intrinsicValue ≤ scenarioHigh` with real numbers and the <2-valid → null case; sentinel-throw case preserved (route maps to 200-unavailable per ADR-12, with `scenarioLow/High: null`, `validMethodCount: 0` added).
- **Task 7 (Positions gating):** preserved (see Summary). Realized P/L not re-gated on quantity (ADR-18/PT-I1). "none" state unchanged.
- **Task 8 (reorder):** Positions is now LAST in `ALL_TABS` on both route pages. Tab selection uses `ALL_TABS.filter(...)` + `tabs.some(...)` (value-based), not index arithmetic — `shouldShowPositionsTab` + `effectiveTab` still work; the reorder broke no index-based assumption.
- **Task 9 (News box):** `SentimentScore` render + import removed from the portfolio route; `newsArticles` + `NewsFeed` retained; `components/sentiment-score.tsx` deleted with no remaining importer; research route News tab unaffected (renders `NewsFeed` alone, as it always has).
- **Scope/forbidden:** no DB migration; no re-introduced `hsl(var(--x))`; services stay pure; sell/FIFO paths untouched.
- **Standing checklist:** working tree clean; STATUS.md 11 lines, links-only, no narrative/custom sections; TECH_DEBT/DECISIONS/ADR structures conform (TD-DTL-TGT/REV moved to Resolved with dates, TD-DTL-REV2 narrowed, four ADR-worthy relabels tracked); no secrets (scan clean); `## Verify` block present and passing (122/122). `plans/INDEX.md` row for this plan reads `in review` — correct (implementation done, this review not yet stamped IMPLEMENTED).

## Proposed DECISIONS.md entries
None. All decisions for this batch were pre-resolved by the owner as OD-1/OD-2/OD-3 and are already captured in `AGENT.md` fragile-surface entries and `TECH_DEBT.md` (TD-DTL-TGT, TD-DTL-REV, TD-DTL-SCEN, TD-DTL-ASSUMP resolved; TD-DTL-REV2 narrowed). No new non-obvious decision was introduced by the implementation that lacks a home.
