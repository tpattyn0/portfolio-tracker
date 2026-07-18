# Plan: Performance audit and prioritized remediation
Date: 2026-07-18

## Problem

The owner reports the product "sometimes feels slow." This plan is the output of a
concrete performance audit of the codebase (not a feature): every finding below cites
a `file:line` and each remediation task is independently implementable and verifiable.

The audit found that "slow" is not one thing. There are four independent classes of
problem, in rough order of user-perceived impact:

1. **A global 30-second refetch storm.** The single React Query client sets
   `refetchInterval: 30 * 1000` as a *default for every query in the app*
   (`components/providers.tsx:13`), on top of `refetchOnWindowFocus`. Every open
   research tab, the wishlist, and the dashboard silently re-hit their (expensive,
   external-API-backed) endpoints every 30s regardless of staleness. This is the
   single largest source of background load and of the app "feeling" busy/janky.

2. **Per-position and per-wishlist-item external-API fanouts on the hot path.** The
   dashboard portfolio request makes one uncached Yahoo `chart` call *per position*
   for yesterday's close (`app/api/portfolio/route.ts:148-180`); the wishlist makes
   ~5 external calls *per item*, and its internal Gemini sentiment analysis runs
   sequentially (`lib/services/wishlist.service.ts:168-257`, `news.service.ts:352-358`).
   These are the slowest single responses in the app.

3. **Duplicate and redundant work.** The Overview and Technical tabs fetch the
   *identical* `/api/market/chart/[symbol]?period=1Y` endpoint under two different
   React Query keys (`components/overview.tsx:21` key `["chart",symbol,"1Y"]` vs
   `components/technical-analysis.tsx:36` key `["technical-analysis",symbol]`), so the
   same 1Y history + full technical-indicator recompute runs twice. The chart route
   also recomputes indicators on every call with no result cache
   (`app/api/market/chart/[symbol]/route.ts:22-30`), and sends no HTTP cache headers.

4. **Everything is client-rendered; no streaming, code-splitting, or shipped-dep
   hygiene.** Every dashboard page is `"use client"` (7/7), only one `loading.tsx`
   exists, there is zero `next/dynamic` usage, and `recharts`/`@tremor/react`/
   `zustand`/`axios` are shipped as dependencies while being unused or replaceable
   (TD-30/TD-16/TD-04; `recharts` now has zero imports too — ADR-11 — but is still in
   `package.json`).

Two DB indexes are also missing on the closed-positions hot path.

## Approach

Fix in impact order, smallest-blast-radius first. The refetch storm (Task 1) is a
one-file change that removes the biggest source of load and must land first. Then kill
redundant work (Tasks 2–3), then the two server fanouts (Tasks 4–5), then DB indexes
(Task 6), then rendering-strategy and bundle hygiene (Tasks 7–9) which are lower
user-perceived impact per unit effort.

Key decisions and tradeoffs:

- **Per-query cache policy, not a global poll.** Remove the global `refetchInterval`;
  set `staleTime` per query by data volatility (quotes/prices short, chart/fundamentals
  long). Live-ness for portfolio prices is already handled by `usePriceSync` (a 5-min
  explicit sync + invalidate, `hooks/use-price-sync.ts:27`), so a 30s poll on *every*
  query was redundant with the one deliberate refresh path. Tradeoff: research/wishlist
  data is no longer auto-live; that is correct — it is reference data, refreshed on
  navigation/focus, not a ticker tape.

- **Server-side caching stays in-process (ADR-4) for this pass.** A shared cache
  (Redis/Upstash) is explicitly out of scope — it is an infra decision tied to the
  still-unconfirmed deployment target (ADR-4 Confidence: Medium). Every remediation
  here works within the current in-process model; where in-process caching is
  insufficient (chart indicators, portfolio day-change) we extend the existing
  `market-data.service` cache rather than introduce infra. See ## Assumptions.

- **No scoring-math changes.** Every task is a data-path/caching/rendering change.
  The financial calculation services (`technical`/`fundamental`/`intrinsic`) are
  touched only to add memoization/caching around already-correct outputs, never to
  change a number (AGENT.md: those services are the core of the product; a wrong
  number is silent). Task acceptance checks assert output parity.

- **RSC migration is scoped narrowly.** A full "make pages Server Components" rewrite
  is a large architectural change and risks the auth/React-Query/`usePriceSync` model.
  Task 7 only adds `loading.tsx` streaming boundaries (cheap, high perceived-perf
  win) and leaves the client-component data model intact. A deeper RSC move is logged
  as a follow-up in `future_ideas.md`, not attempted here.

## Tasks

Work in order. `[ ] todo · [~] in progress · [x] done · [!] blocked`.

1. [ ] **Remove the global 30s refetch storm; set per-query cache policy.**
   In `components/providers.tsx:9-16` remove `refetchInterval: 30 * 1000` from the
   `QueryClient` `defaultOptions`; keep a sane default `staleTime` (e.g. 60s) and
   `refetchOnWindowFocus: false` as the default. Then set explicit `staleTime` on the
   queries that lack one so behaviour is intentional per call site:
   `components/technical-analysis.tsx:35` (add `staleTime: 5*60*1000`), the
   `research/[symbol]/page.tsx` ownership `useQuery` (`:64`), and
   `components/research/detail-price-chart.tsx:52` (add `staleTime: 5*60*1000`).
   Leave the dashboard portfolio query's own `staleTime`/`refetchOnWindowFocus`
   (`dashboard/page.tsx:39-40`) intact — that one is deliberate and cheap.
   — Acceptance: grep shows no `refetchInterval` in `components/providers.tsx`;
   loading a research page and idling for >60s issues no repeat `/api/market/*`
   requests (observe Network tab / server logs). `npm run verify` green.

2. [ ] **De-duplicate the Overview/Technical chart+indicator fetch.**
   `components/technical-analysis.tsx:36` and `components/overview.tsx:21-28` fetch the
   same `/api/market/chart/[symbol]?period=1Y` under different query keys, so the
   Overview→Technical tab switch refetches identical data and re-runs
   `calculateIndicators`. Unify the query key (both use `["chart", symbol, "1Y"]`) so
   React Query serves the second from cache. `DetailPriceChart` already uses
   `["chart", symbol, period]` (`detail-price-chart.tsx:53`) — confirm it shares too.
   — Acceptance: opening Overview then Technical for the same symbol issues exactly one
   `GET /api/market/chart/<sym>?period=1Y` (Network tab). Rendered technical values
   unchanged vs. before. `npm run verify` green.

3. [ ] **Cache computed technical indicators + add HTTP cache headers on the chart route.**
   `app/api/market/chart/[symbol]/route.ts:22-30` recomputes `calculateIndicators`
   (SMA/EMA/RSI/MACD/… over 205+ points) on every request even though the underlying
   1Y history is already cached 60s in `market-data.service`. Memoize the computed
   `indicators` keyed by `symbol` with the same/greater TTL (extend the existing
   `market-data.service` cache or add a small keyed cache in the technical service —
   do not introduce new infra). Add `Cache-Control: private, max-age=60` (or similar)
   to the JSON response so React Query refetches are served cheaply.
   — Acceptance: a unit test asserts `calculateIndicators` output is byte-identical
   before/after caching for a fixed input; two sequential requests within TTL for the
   same symbol compute indicators once (spy/log). Response carries a `Cache-Control`
   header. `npm run verify` green.

4. [ ] **Fix the dashboard day-change per-position fanout.**
   `app/api/portfolio/route.ts:148-180` fires one `getHistoricalRange(...,'1d')` Yahoo
   call per position on every dashboard load to derive yesterday's close, uncached
   beyond the 60s window and serialized only by `Promise.all`. Replace the per-position
   historical-range call with the `previousClose` already available on the quote
   (`market-data.service.getQuote` returns `previousClose`,
   `market-data.service.ts:77`) — `usePriceSync` already fetches quotes, so day-change
   can be computed from `currentPrice` vs `previousClose` without a second round-trip
   per position. If `previousClose` is genuinely needed from history for some tickers,
   batch/cache it; do not leave an uncached per-position external call on the hot path.
   — Acceptance: loading the dashboard makes no `chart`/`getHistoricalRange` call per
   position (server logs); `dayChange`/`dayChangePercent` match the previous
   implementation within rounding for a fixed fixture. `npm run verify` green.

5. [ ] **Parallelize wishlist per-item scoring and its sequential Gemini calls.**
   `lib/services/wishlist.service.ts:168-257`: each item already runs inside
   `Promise.all`, but *within* an item the five score fetches are sequential `await`s
   that are independent (fundamentals, analyst, technical, sentiment, intrinsic) —
   parallelize them with `Promise.all`. Separately, `news.service.ts:352-358` analyzes
   unanalyzed articles in a sequential `for … await` loop; batch those with
   `Promise.all` (bounded concurrency) so a wishlist of N items doesn't serialize
   N×(up to 3) Gemini round-trips. Keep the per-item DB `currentPrice` write, but
   consider dropping the redundant write when the price is unchanged.
   — Acceptance: a fixture wishlist's `getWishlistWithScores` issues its 5 per-item
   score fetches concurrently (assert via timing/mock ordering); composite scores are
   identical to before for a fixed fixture (no math change). `npm run verify` green.

6. [ ] **Add the two missing DB indexes on the closed-positions hot path.**
   `app/api/portfolio/closed-positions/route.ts:50-70` queries `Position` filtered by
   `portfolioId` + `transactions.some(type: SELL)` and loads all `transactions`
   ordered by `executedAt`. `Transaction` has `@@index([executedAt])` and
   `@@index([portfolioId])` but no composite `@@index([positionId, executedAt])`,
   which is the access pattern for the per-position FIFO replay (ADR-5 notes cost
   grows with history). Add `@@index([positionId, executedAt])` to `Transaction` in
   `prisma/schema.prisma:86-88`, and `@@index([type])` if query plans show a benefit.
   Generate the migration but DO NOT apply it to the shared dev/prod DB without owner
   sign-off (ADR-6 / TD-02 — one shared database, no isolated dev DB). See ## Open
   decisions.
   — Acceptance: `prisma migrate diff` / generated migration adds the composite index;
   schema still validates (`prisma validate`). Migration is *created, not applied*
   pending owner sign-off. `npm run verify` green.

7. [ ] **Add streaming loading boundaries to the remaining pages.**
   Only `app/(dashboard)/dashboard/loading.tsx` exists; the research, research-detail,
   wishlist, closed-positions, and portfolio-detail routes have no `loading.tsx`, so
   navigation shows a blank frame until the client component's first fetch resolves.
   Add a lightweight `loading.tsx` (skeleton, reusing the dashboard skeleton pattern)
   to each `app/(dashboard)/**` route that fetches on mount. This is a cheap,
   high-perceived-perf change and does not alter the client data model.
   — Acceptance: each targeted route has a `loading.tsx`; navigating to it shows a
   skeleton immediately (no blank flash) in the browser. `npm run verify` green.

8. [ ] **Remove unused/replaceable heavy dependencies (bundle hygiene).**
   `recharts` now has zero imports (`grep -rln recharts app components` → none; ADR-11
   deleted its last caller) yet remains in `package.json`; `@tremor/react` (TD-30) and
   `zustand` (TD-16) are also unused; `axios` (TD-04) has CVEs and is used only in
   `news.service.ts:199` — replace that one call with `fetch` (already used in
   `exchange-rate.service.ts`) and drop the dep. Remove all four from `package.json`
   and run `npm install` to update the lockfile.
   — Acceptance: `grep -rln "recharts\|@tremor/react\|zustand\|axios" app components lib`
   returns nothing; `package.json` no longer lists them; `npm run verify` green
   (typecheck confirms no dangling imports). Update TD-04/TD-16/TD-30 to Resolved.

9. [ ] **Code-split the heaviest client-only surfaces.**
   The research-detail page eagerly imports all seven tab components
   (`research/[symbol]/page.tsx:8-14`) though only one renders at a time. Convert the
   non-default tabs (Technical, Fundamental, Analyst, Intrinsic, Transactions, News) to
   `next/dynamic` imports so their JS is not in the initial route bundle. Apply the
   same to any other single-heavy-component page found during the pass.
   — Acceptance: the six non-default research tabs load via `next/dynamic`; the
   research-detail route's initial JS bundle shrinks (compare `next build` output
   before/after). Tab switching still works in the browser. `npm run verify` green.

## Files to create or modify

- `components/providers.tsx` — remove global `refetchInterval`, set default cache policy (Task 1)
- `components/technical-analysis.tsx` — unify chart query key + add `staleTime` (Tasks 1–2)
- `components/overview.tsx` — confirm/unify chart query key (Task 2)
- `components/research/detail-price-chart.tsx` — add `staleTime` (Task 1)
- `app/(dashboard)/research/[symbol]/page.tsx` — `staleTime` on ownership query (Task 1); `next/dynamic` tabs (Task 9)
- `app/api/market/chart/[symbol]/route.ts` — indicator cache + `Cache-Control` header (Task 3)
- `lib/services/technical-analysis.service.ts` or `market-data.service.ts` — keyed indicator cache (Task 3)
- `app/api/portfolio/route.ts` — day-change from `previousClose`, drop per-position history fanout (Task 4)
- `lib/services/wishlist.service.ts` — parallelize per-item score fetches (Task 5)
- `lib/services/news.service.ts` — parallelize Gemini analysis loop; replace `axios` with `fetch` (Tasks 5, 8)
- `prisma/schema.prisma` — composite `Transaction` index; generated migration (Task 6)
- `app/(dashboard)/research/loading.tsx`, `research/[symbol]/loading.tsx`, `wishlist/loading.tsx`, `portfolio/closed-positions/loading.tsx`, `portfolio/[ticker]/loading.tsx` — new (Task 7)
- `package.json` / lockfile — remove `recharts`, `@tremor/react`, `zustand`, `axios` (Task 8)
- `TECH_DEBT.md` — move TD-04/TD-16/TD-30 to Resolved (Task 8); update TD-05-adjacent notes if touched

## Verification

`## Verify` block in `AGENT.md` (`npm run verify`) runs automatically for every task.
Beyond it:

- **Parity checks (must not regress a number).** Tasks 3, 4, 5 change data paths that
  feed financial figures. Each must include a test asserting output equality against a
  fixed fixture before/after the change (indicators unchanged, day-change unchanged,
  composite scores unchanged). A wrong number here is silent (AGENT.md).
- **Network-level verification (Playwright or manual Network tab).** Tasks 1, 2, 4, 9
  are about *how many* requests fire and *when*. Verify in the browser: no 30s
  background refetch (Task 1); one 1Y chart request across Overview+Technical (Task 2);
  no per-position history call on dashboard load (Task 4); reduced initial JS on the
  research route (Task 9).
- **Do not apply the Task 6 migration** to the shared DB without owner sign-off.

## Assumptions

- **Deployment target is single-instance / not yet deployed** (ADR-4, ADR-6, TD-02).
  This is why in-process caching (Task 3) is acceptable and a shared cache is out of
  scope. If the app is deployed multi-instance, Task 3's cache and the rate limiter
  (TD-06) both need a shared store — a separate infra decision, not this plan.
- **`previousClose` from the quote is an acceptable basis for dashboard day-change**
  (Task 4). If the product specifically needs *prior trading day's official close*
  distinct from Yahoo's `regularMarketPreviousClose`, Task 4's approach changes; the
  parity acceptance check will surface any divergence for the owner to judge.
- **Removing auto-refetch on research/wishlist data is desired** (Task 1). These are
  reference/analysis surfaces, not a live ticker; portfolio price liveness is retained
  via `usePriceSync`. If the owner wants live-updating research data, Task 1's
  `staleTime` values become the knob.

## Open decisions

- **Task 6 migration application.** The composite index is safe to *create*, but
  applying any migration touches the shared dev/prod database (ADR-6 / TD-02 — no
  isolated dev DB). The owner must sign off on applying it, or defer application until
  a staging DB exists. The Coding agent should create the migration and stop short of
  applying it.
