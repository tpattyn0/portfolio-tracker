# Review: full codebase audit
Date: 2026-07-17
Status:

## Summary
Findings: 0 BLOCKERs, 7 ISSUEs, 3 SUGGESTIONs, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: AUD-01..AUD-10

Scope: full audit of branch HEAD (`fix/supabase-reconnect`, `1f699170` — content already merged to main via PR #9). Security pass on the branch diff: clean (only `directUrl = env("DIRECT_URL")` plus docs). Auth sweep across all 23 API routes: every route guarded except the two intentionally public ones (`auth/[...nextauth]`, `auth/register` — the latter rate-limited). Ownership scoping verified on all mutation paths (positions buy/sell/delete, wishlist CRUD) — correct throughout. Verify block passes at HEAD: typecheck ok · lint ok (pre-existing warnings only) · 10/10 tests · secret-scan clean. Standing checklist: working tree clean, STATUS.md 8 lines/links-only, `.env` + `scratch/` gitignored, no secrets in tracked files. AGENT.md fragile-surface claims re-verified: `lib/env.ts`/`lib/utils/env.ts` still dead, `zustand` still unimported, `IndustryComparison` still write-orphaned.

Not re-flagged (already tracked, severity unchanged): TD-01..TD-08, TD-11, TD-13..TD-15, TD-19, TD-28.

## Findings

### AUD-01 — ISSUE
**File:** .env.example:2, ARCHITECTURE.md:60, DECISIONS.md:39 (ADR-6)
**Problem:** This branch made `DIRECT_URL` a required env var (`prisma/schema.prisma:10`), but `.env.example` doesn't list it — a fresh clone following the template cannot run migrations (`prisma migrate` needs the session-mode pooler URL). ARCHITECTURE.md §Environment separation and ADR-6 also still describe the old setup: "two connection strings (one direct, one pooled) for the same underlying database … selected based on which network the developer is on." Post-reconnect, the two strings serve different *purposes* simultaneously (`DATABASE_URL` = transaction-mode pooler :6543 for the app, `DIRECT_URL` = session-mode pooler :5432 for migrations), and the referenced Supabase project itself is a different one.
**Recommendation:** Add `DIRECT_URL` to `.env.example` with a comment explaining the pooler split. Rewrite ARCHITECTURE.md:58-60 and ADR-6's Decision/Evidence text to describe the url/directUrl split against the new project. ADR-6's substance (dev and prod share one DB) still stands — only the mechanics described are stale.

### AUD-02 — ISSUE
**File:** app/api/portfolio/positions/route.ts:39-80
**Problem:** The "position already exists" branch of POST /api/portfolio/positions duplicates the buy-more logic of `positions/[ticker]/buy/route.ts` and diverges from it in three ways: (1) `transaction.create` (line 48) and `position.update` (line 64) are NOT wrapped in `prisma.$transaction` — a failure between them leaves a transaction row with no position update (the buy route and this file's own new-position branch both use `$transaction`); (2) portfolio totals (`totalValue`/`totalCost`/`unrealizedPL`) are never recalculated, unlike the buy route's step 3-4 — the dashboard shows stale totals until the next price sync; (3) `unrealizedPL` is reset to 0 and `marketValue` set to purchase price (lines 69-71). Two implementations of the same operation with different arithmetic (float here, Decimal there) is exactly the drift the buy route was written to avoid.
**Recommendation:** Make the existing-position branch delegate to the same logic as `positions/[ticker]/buy` (extract into a shared service function per ADR-3), or at minimum wrap it in `$transaction` and recalculate portfolio totals identically.

### AUD-03 — ISSUE
**File:** app/api/portfolio/positions/[ticker]/sell/route.ts:50-52, app/api/portfolio/closed-positions/route.ts:96-117
**Problem:** Two different accounting methods produce "realized P/L" in different parts of the UI. The sell route computes it as `sale − avgCostBasis·qty − sellFees`, where `avgCostBasis` includes buy fees; this accumulates into `portfolio.realizedPL`. The closed-positions page recomputes it via FIFO lot matching using raw buy `price` (excluding buy fees) and ignores sell fees entirely. For the same transaction history the two numbers disagree — average-cost vs FIFO plus different fee treatment — so `portfolio.realizedPL` and the closed-positions "Total realized P/L" aggregate silently contradict each other.
**Recommendation:** Pick one method (FIFO including all fees is the defensible one for per-trade reporting) and make both surfaces use it — ideally one shared service function with tests. At minimum, make the closed-positions FIFO include buy and sell fees so the totals reconcile.

### AUD-04 — ISSUE
**File:** app/api/portfolio/closed-positions/route.ts:150
**Problem:** `isPartial: remainingSellQuantity.gt(0)` is dead logic — lines 109-112 `continue` (skip the entry entirely) whenever `remainingSellQuantity.gt(0)`, so by line 150 the value is always `false`. Every closed position renders as fully closed, and unmatched sells vanish from the list with only a `console.warn`. Note this is inside the exact surface AGENT.md flags as fragile (single-copy FIFO logic, zero test coverage).
**Recommendation:** Decide what `isPartial` should mean (sell that only partially closed the position at that time) and compute it from position state, not the FIFO remainder; surface unmatched sells instead of silently dropping them. Add the first unit tests for this route while touching it (TD-07 names it a priority).

### AUD-05 — ISSUE
**File:** lib/services/wishlist.service.ts:230, 242, 266-270
**Problem:** Severity change on TD-10. The self-referential `fetch` calls to `/api/news/[symbol]` and `/api/research/[symbol]/intrinsic-value` send no session cookie, and both target routes have required auth since the ONB-05 fixes (2026-07-16). They now **always return 401**, so `sentimentScore` and `intrinsicScore` are always `null` — the composite score silently substitutes neutral 5s for 40% of its weight (0.25 intrinsic + 0.15 sentiment). TD-10 describes this path as "fragile"; it is functionally broken. Separately, the fallback `(score || 5)` at lines 266-270 treats a legitimate score of 0 as "missing" and replaces it with 5.
**Recommendation:** Refactor to call `newsService`/`IntrinsicValueService` directly (the fix TD-10 already prescribes — this finding raises its priority from Low to High). Use `?? 5` instead of `|| 5`. Update the TD-10 row: severity High, impact "sentiment/intrinsic sub-scores silently dead since 2026-07-16".

### AUD-06 — ISSUE
**File:** app/api/portfolio/positions/route.ts:152-157, app/api/insights/portfolio/route.ts:144
**Problem:** Both 500 handlers return raw `error.message` to the client (`{ error: error.message }` / `details: error.message`). Prisma and upstream-API error messages can carry internals (model/field names, hostnames, upstream response fragments). The project deleted `api/test-yahoo` for exactly this pattern (TD-20/ONB-02). The wishlist routes' 400s returning service-thrown messages ("already in your wishlist") are fine — those are deliberate user-facing validation strings — but unexpected-error paths should not echo internals.
**Recommendation:** Return generic bodies on 500 (`"Failed to add position"` etc.), keep the detail in `console.error` only — matching what every other route already does.

### AUD-07 — ISSUE
**File:** AGENT.md:18, TECH_DEBT.md:19 (TD-12), TECH_DEBT.md:23 (TD-16)
**Problem:** Doc drift. (1) AGENT.md and TD-12 state the insights route uses `gemini-1.5-pro` → `gemini-pro` fallback; the code's primary model is `gemini-1.5-flash` (app/api/insights/portfolio/route.ts:69) — both Gemini call sites now use 1.5-flash as primary. The nested try/catch "fallback" (lines 71-79) is also dead code: `getGenerativeModel` doesn't validate the model name, so it never throws there. (2) TD-16 says `zustand` is "oddly listed under `devDependencies`"; it now sits in `dependencies` (package.json) — still unimported anywhere, so the item stands but its text is stale.
**Recommendation:** Fix both doc entries; optionally delete the dead model-fallback try/catch while touching the insights route (it misleads readers into thinking a fallback exists).

### AUD-08 — SUGGESTION
**File:** app/api/portfolio/positions/[ticker]/buy/route.ts:16-25, app/api/portfolio/positions/[ticker]/sell/route.ts:16-25
**Problem:** Buy and sell accept unvalidated JSON bodies: `fees` may be negative (inflates realized P/L on sell), `date` is unchecked (garbage strings produce Invalid Date → Prisma throw → 500), and non-numeric `quantity`/`price` strings pass the `<= 0` check then throw inside `new Decimal(...)` → 500. Self-harm only (data is user-scoped), but the sibling routes (`register`, positions POST) already use zod.
**Recommendation:** Add a zod schema matching `addPositionSchema` (positive numbers, `fees: z.number().min(0).default(0)`, ISO date string) to both routes.

### AUD-09 — SUGGESTION
**File:** lib/middleware/rate-limit.ts:20
**Problem:** The limiter keys on the raw `x-forwarded-for` header, which is fully client-controlled when the app isn't behind a trusted proxy — rotating the header value bypasses every limit (including register's 5/hour), and all unset callers share the `"unknown"` bucket. Acceptable for the current non-deployed, single-instance posture, but it's a second weakness of the same component TD-06 tracks.
**Recommendation:** Fold into TD-06: when moving to a shared store, also derive the client IP from the platform's trusted source (e.g. Vercel's `x-real-ip`/first XFF hop set by the edge) rather than the raw header.

### AUD-10 — SUGGESTION
**File:** app/api/insights/portfolio/route.ts:49-61, 126-137
**Problem:** When `GEMINI_API_KEY` is missing or the AI call fails, the route **persists** the placeholder/fallback text as that day's `PortfolioInsight` row. The `userId_date` unique key plus the existing-insight early-return means a single transient Gemini failure at 00:05 pins "AI analysis temporarily unavailable" for the whole day, even after the key is configured or the outage resolves.
**Recommendation:** Return placeholder/fallback responses without persisting them (only persist successful generations), or store a `failed` flag that the cache check treats as retriable.

## Proposed DECISIONS.md entries

None — no new architectural decisions surfaced; AUD-01 amends ADR-6's descriptive text, not its decision.
