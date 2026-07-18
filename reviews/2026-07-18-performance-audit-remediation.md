# Review: performance audit and prioritized remediation
Date: 2026-07-18
Status:

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 2 SUGGESTIONs, 1 QUESTION
Requires owner decision: PAR-Q1 (apply the Task 6 migration to the shared dev/prod DB)
Ready for Coding agent: PAR-S1, PAR-S2

Reviewed branch HEAD (`cc86649a`, the implementation commit) of PR #15 against
`plans/2026-07-18-performance-audit-remediation.md`. Working tree clean.
`npm run verify` green: typecheck ok, lint ok (pre-existing warnings only,
none introduced), 83/83 tests, secret-scan `no leaks found`. Security pass
(manual, against the CLAUDE.md checklist — the `security-review` skill
delegates to sub-tasks that write no persistent artifact) found no new attack
surface: no new unauthenticated endpoints (chart route keeps its
`getServerSession` guard, portfolio route keeps `getAuthenticatedUser`), no
injection surface (the `axios`→`fetch` NewsAPI call builds its query via
`URLSearchParams`, no interpolation), no credentials at rest, and the new
`Cache-Control: private, max-age=60` on the chart route is correctly scoped
`private` for an authenticated response.

This is a clean, well-scoped implementation. All nine tasks are done, the three
parity-sensitive tasks (3, 4, 5) carry real financial-output-equality
assertions rather than superficial ones, and the one owner-gated item (Task 6
migration) was correctly created-but-not-applied. The two SUGGESTIONs are
optional polish; neither blocks.

### Parity-test verdict (the load-bearing question per AGENT.md — "a wrong number is silent")
- **Task 3 (indicators):** `technical-analysis.service.test.ts` asserts
  `getCachedIndicators(...)` `.toEqual(...)` the direct `calculateIndicators(...)`
  output byte-for-byte on a fixed 220-point fixture, plus cache-once,
  per-symbol keying, and fingerprint-miss recompute. Genuine parity. The
  fingerprint (`length:lastClose`) is safe in the one production caller: the
  chart route always feeds the `"1Y"` series for indicators regardless of the
  display period (`route.ts:25`), so a same-symbol/different-lookback collision
  cannot occur on the hot path.
- **Task 4 (day-change):** `route.test.ts` asserts `dayChange`/`dayChangePercent`
  equal the old historical-range formula's output for the same yesterday-close
  fixture, asserts `getHistoricalRange` is NOT called (regression guard), and
  asserts the `previousClose === 0` fallback yields zero day-change. The formula
  is preserved; only the data source changed (`getQuote().previousClose` vs
  `getHistoricalRange(...,'1d')`), which the plan explicitly logs as an
  Assumption — see PAR-S1.
- **Task 5 (composite scores):** `wishlist.service.concurrency.test.ts` asserts
  all five per-item fetches start before any resolves (true concurrency) AND
  that the composite score equals a hand-computed `6.6` from the individual
  dimension scores and documented weights. Genuine parity, not superficial.

### Task-by-task confirmation
- **Task 1 — liveness preserved.** Global `refetchInterval: 30*1000` removed;
  `refetchOnWindowFocus: false` set as default. Every deliberate live surface
  keeps its own explicit poll: dashboard `refetchOnWindowFocus: true`,
  portfolio-detail `refetchInterval: 30000`, wishlist `refetchInterval: 60000`,
  news-feed `5*60*1000`. Portfolio price liveness is `usePriceSync`'s 5-min
  explicit sync — untouched. No live surface silently lost refresh.
- **Task 2 — dedupe confirmed.** `overview.tsx:21`, `technical-analysis.tsx:36`
  now both key `["chart", symbol, "1Y"]`; `detail-price-chart.tsx:53` shares via
  `["chart", symbol, period]` (period="1Y" on Overview). Same endpoint, same
  response shape, so cache-sharing is safe.
- **Task 4 — perf win real.** `getQuote` is 60s-cached in `market-data.service`
  (`quote:${symbol}`), and `previousClose` derives from
  `regularMarketPreviousClose || 0`, so the loop is cache-hit (no second
  round-trip) and missing-previousClose maps to the "no change" fallback.
- **Task 6 — created, NOT applied (verified).** `prisma migrate status`:
  `20260718152229_add_transaction_position_executedat_index` reported as "not
  yet been applied". Migration SQL is a single additive `CREATE INDEX`, no
  destructive statements. Correctly awaiting owner sign-off — see PAR-Q1.
- **Task 8 — no dangling imports.** `grep -rln "recharts|@tremor/react|zustand|axios" app components lib`
  returns nothing; none remain in `package.json`; typecheck (part of verify)
  confirms no broken imports. The `axios`→`fetch` swap in `news.service.ts`
  preserves behavior: identical URL/params/5s-timeout (via `AbortController`),
  equivalent error handling (explicit `!response.ok` throw restores axios's
  auto-throw-on-non-2xx), and no custom headers were sent by the axios version
  so none were lost.

### ADR review
- **ADR-13** (per-query staleTime replaces global refetch): well-formed —
  Decision/Evidence (cites `providers.tsx` + three call sites with lines)/
  Rationale/Tradeoffs/Status (accepted)/Confidence (High, network-verified).
- **ADR-14** (composite index created, not applied): well-formed and correctly
  scoped `Status: proposed — blocked on owner sign-off`, matching the actual
  pending migration state. Evidence cites the schema line and the migration SQL.

## Findings

### PAR-Q1 — QUESTION
**File:** `prisma/migrations/20260718152229_add_transaction_position_executedat_index/migration.sql`; plan Open decisions; ADR-14
**Problem:** The composite `Transaction[positionId, executedAt]` index is
created but not applied (`prisma migrate status` confirms pending). Applying any
migration touches the shared dev/prod database (ADR-6 / TD-02 — no isolated dev
DB), so the closed-positions hot path does not yet benefit from the index. The
SQL is a single additive, non-destructive `CREATE INDEX`.
**Recommendation:** Owner decision required: either sign off on running
`prisma migrate deploy` against the shared DB (the index is additive and safe,
but it is a shared-prod-DB write), or defer application until a staging DB
exists (TD-02). No code change; this is purely a go/no-go on applying the
migration. The Coding agent must not apply it without this sign-off.

### PAR-S1 — SUGGESTION
**File:** `app/api/portfolio/route.ts:156-157`; plan Assumptions
**Problem:** Task 4 swaps `getHistoricalRange(...,'1d')` for
`getQuote().previousClose` (Yahoo's `regularMarketPreviousClose`). The parity
test asserts the *formula* is unchanged but, by design, cannot assert the two
*data sources* return the same number — during pre-market/after-hours or on a
half-day, `regularMarketPreviousClose` can differ from the prior session's
official close the old path fetched. The plan flags this as an accepted
Assumption; it is not a defect, but it is a silent behavior change on an
edge-case data path.
**Recommendation:** No code change required now — the Assumption is owner-approved
via the plan. Optionally, if the owner later reports day-change looking "off"
around market open, this is the first place to look; the AGENT.md fragile-surface
entry already documents that a future need for the *prior official trading-day
close* is a deliberate behavior change requiring a fresh parity check, not a
silent revert. Nothing to action unless the owner raises it.

### PAR-S2 — SUGGESTION
**File:** `lib/services/wishlist.service.ts:255,263`
**Problem:** Post-parallelization, `calculateSentimentScore(...)` and
`upsideToScore(...)` now run in the `if (result.status === 'fulfilled')` branch
rather than inside the old per-dimension `try/catch`. Both helpers are pure and
do not throw on the fulfilled values, so behavior is equivalent today. But a
future change that makes either helper throw would now be caught only by the
outer per-item `try/catch` (line 316), which nulls *all five* scores for that
item rather than just the one — a wider blast radius than the pre-change
per-dimension isolation.
**Recommendation:** Low priority. If either helper ever gains logic that can
throw, wrap that single computation in its own guard so one dimension's failure
stays isolated (matching the `Promise.allSettled` per-dimension isolation the
rest of the function preserves). No action needed while both helpers remain
pure.

## Proposed DECISIONS.md entries
None — ADR-13 and ADR-14 were added by the implementation and are well-formed;
no further ADRs required.
