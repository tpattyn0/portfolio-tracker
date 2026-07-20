# Review: configurable per-user scoring weights (PR #22)
Date: 2026-07-20
Status: IMPLEMENTED — 2026-07-21 (code + review complete; migration created but NOT applied — owner `prisma migrate deploy` required before the feature is live)

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 2 QUESTIONs
Requires owner decision: SCW-Q1 (owner must run `prisma migrate deploy` before the feature works live), SCW-Q2 (visual/live click-through of the settings page + live composite update)
Ready for Coding agent: SCW-S1 (optional — a small clarifying comment; non-blocking)

Reviewed branch HEAD `a6d2d4b6` against `origin/main` (`git fetch --prune` first; working tree clean, branch pushed). This is a large, well-executed feature diff (2505 insertions across 28 files). Every high-risk property called out in the task was verified statically against the actual code and its tests, not assumed:

- **(A) Normalization math** — correct on all four cases; no div-by-zero / NaN path.
- **(B) Backward-compat** — `DEFAULT_SCORING_WEIGHTS` exactly equals the pre-feature hardcoded values; a user with no prefs row scores byte-identically to today, asserted by tests.
- **(C) Cache-safety (ADR-4/ADR-21)** — the per-user fundamental reweight is applied on read, after `saveToDatabase`, and never written back to the shared symbol-keyed cache. Verified on both fresh and cache-hit paths, with a dedicated test.
- **(D) Service purity (ADR-3)** — the service takes `fundamentalWeights` as a pure parameter; the route reads prefs. No DB read for weights inside the service.
- **(E) Single source of truth** — a repo-wide grep for any hardcoded composite/fundamental weights object outside `lib/utils/scoring-weights.ts` finds nothing; a grep-based test enforces it.
- **(F) Migration** — additive-only, owner-gated, matches `schema.prisma` exactly.
- **(G) API auth + validation** — GET/PUT gate on `getAuthenticatedUser` (401 unauth); PUT rejects negative/non-finite (400); the fundamentals route migrated to `getAuthenticatedUser` with no auth regression.
- **(Security) IDOR** — `userId` is taken from the session on every write; the body cannot inject a `userId` or arbitrary columns.

`npm run verify` was run locally and passes: typecheck ok · lint ok (pre-existing warnings only) · 193/193 tests · secret-scan clean.

The security-review skill was run against the diff; it surfaced no HIGH/MEDIUM findings, consistent with the manual security pass below.

Apart from the two owner-action QUESTIONs (which are process/deploy gates, not code defects) the implementation is clean and ready.

## Findings

### SCW-Q1 — QUESTION (owner action: apply the migration)
**File:** `prisma/migrations/20260720220007_user_scoring_preferences/migration.sql`
**Problem:** The migration was generated with `prisma migrate dev --create-only` and is intentionally NOT applied (correct per the ADR-6/ADR-14/ADR-19 owner-gated protocol — dev and prod share one Supabase DB, so no migration is applied without explicit owner sign-off). This is not a defect and must not be treated as one. The consequence to make visible: until the owner runs `prisma migrate deploy`, the `UserScoringPreferences` table does not exist in the live database, so `GET`/`PUT /api/settings/scoring-weights` — and the per-user fundamental/composite reweight paths that call `getWeights()` — will 500 against the real table, even though the code and the regenerated Prisma Client are complete. The `getWeights` coalescing does not rescue this: the failure is at the Prisma query (missing relation), before any coalescing.
**Recommendation:** Owner runs `prisma migrate deploy` (with `DIRECT_URL` set) to create the table, then confirms `prisma migrate status` shows it applied. No code change. The migration SQL was reviewed and is additive-only (`CREATE TABLE`, two `CREATE INDEX`, one `ADD CONSTRAINT` FK — no `DROP`/`ALTER DROP`/destructive statement) and matches the `UserScoringPreferences` model in `schema.prisma` exactly (10 `Float?`/`DOUBLE PRECISION` columns, `userId` unique index, `onDelete: Cascade` FK to `User`, `User.scoringPreferences` back-relation).

### SCW-Q2 — QUESTION (owner action: live/visual verification the Verify block cannot cover)
**File:** `app/(dashboard)/settings/page.tsx`, `components/overview.tsx`, `components/fundamental-analysis.tsx`
**Problem:** The settings page, the live composite recompute on weight change, and the "Your weighting" meta-kicker swap are client UI behaviors with no unit-test harness (acceptable — see coverage note below). Their correctness is asserted only at the pure-function and service layers, not end-to-end in a browser. Note this depends on SCW-Q1 being applied first (the settings page fetches `/api/settings/scoring-weights`, which 500s until the table exists).
**Recommendation:** After the migration is applied, owner does a click-through: (1) `/settings` renders both Composite and Fundamental sections and loads current weights; (2) editing a weight + Save persists and the toast/dirty-state behaves; (3) on a research Overview tab, the composite score updates to the custom weighting and the "Your weighting" meta-kicker appears; (4) the Fundamental tab's meta-kicker likewise swaps when the fundamental weights differ from defaults. No code change expected — this is confirmation of the wired-up behavior.

### SCW-S1 — SUGGESTION (optional, non-blocking)
**File:** `lib/utils/scoring-weights.ts:148-164` (`weightedFundamentalTotal`)
**Problem:** `weightedFundamentalTotal` divides by the weight sum and guards `weightSum <= 0` by returning `0`. In the actual call paths this guard is unreachable — every caller passes weights that have already been through `normalizeFundamentalWeights` (which can never return an all-zero group; it falls back to defaults). The `return 0` branch is a defensive dead path. This is fine as defense-in-depth, but a reader tracing the "all-zero → defaults" contract might briefly wonder whether an all-zero fundamental group can reach here and yield a `0` total (it cannot). The existing inline comment already explains this; the suggestion is only to consider whether the two-layer guarding (normalize's fallback + this division guard) is worth a one-line cross-reference, or whether the branch is clear enough as-is.
**Recommendation:** No action required. If touched later, a one-word note ("unreachable in practice — callers always pre-normalize") would make the invariant self-evident. Do not add complexity for it.

## Detailed verification notes (for the record — no findings attached)

**(A) Normalization (`normalizeWeights`, lines 82-110).** The four cases are all correct: (1) negatives and non-finite (`NaN`/`Infinity`) are clamped to 0 via `Number.isFinite(value) && value > 0` *before* summing (line 92); (2) an all-zero / all-clamped group hits `sum <= 0` (line 97) and returns the group's own `defaults` — not equal weights, not NaN, no division; (3) a single non-zero weight divides by its own value → 1.0 for that key, 0.0 for the rest; (4) the normal case divides each by the sum, and the result sums to 1.0. Tests assert all four plus the NaN/Infinity case and the partial-input merge. No div-by-zero is reachable. The module is genuinely pure — imports only its own types; no React/DB/IO.

**(B) Backward-compat.** `DEFAULT_SCORING_WEIGHTS` (lines 34-49) is composite `{intrinsicValue 0.25, fundamental 0.25, technical 0.2, sentiment 0.15, analyst 0.15}` and fundamental `{valuation 0.3, profitability 0.3, growth 0.2, financial 0.15, dividend 0.05}` — exactly the documented pre-feature values, each group summing to 1.0, so `normalizeWeights(defaults, defaults)` is a no-op (asserted by the "defaults normalize to themselves" test). `calculateFundamentalScore` now computes its default total via `weightedFundamentalTotal(breakdown, DEFAULT_SCORING_WEIGHTS.fundamental)` (line 361) rather than a second inline formula, and `applyPerUserReweight` returns `metrics` unchanged when no weights are passed (line 157) — so the no-prefs path is byte-identical.

**(C) Cache-safety.** On the fresh path, `saveToDatabase(completeMetrics)` (line 140) persists `metrics.score.total` (the DEFAULT-weighted total) BEFORE `applyPerUserReweight` runs (line 142). `applyPerUserReweight` returns a NEW object (spreads `metrics.score`, replaces only `total` — lines 160-166), never mutating `completeMetrics`, so the persisted value and the shared `scoreDetails.breakdown` stay default/user-independent. On the cache-hit path (line 98), `formatCachedData` reconstructs from the stored row and the reweight is applied to the returned value only. The test `saveToDatabase persists the DEFAULT-weighted total, never the per-user reweighted one` (weights.test.ts:76-83) asserts this concretely even when called with 100%-valuation custom weights, and a companion test asserts the breakdown is identical across default and custom calls. No per-user total can leak into the shared symbol-keyed cache.

**(D) Service purity.** `fetchFundamentals(symbol, fundamentalWeights?)` takes weights as an optional pure parameter and does no `UserScoringPreferences` read. The route (`app/api/market/fundamentals/[symbol]/route.ts:20`) calls `getWeights(auth.userId)` and passes `weights.fundamental` in. ADR-3 boundary preserved.

**(E) Single source of truth.** `grep -rn` for `intrinsicValue: 0.25` / `valuation: 0.3` / `fundamental: 0.25` / `technical: 0.2` / `profitability: 0.3` across `app/`, `components/`, `lib/` (excluding tests and the module itself) returns nothing — the only literal weights object in the repo is `DEFAULT_SCORING_WEIGHTS`. `overview.tsx`, `wishlist.service.ts`, and `fundamental-analysis.service.ts` all consume the shared module. `wishlist.service.ts` passes `weights.fundamental` to `fetchFundamentals` (line 210) and builds its composite via `weightedCompositeTotal(..., normalizedCompositeWeights)` (line 290) — the same function `overview.tsx` calls, so wishlist and Overview produce the identical composite for the same stock+user. The `wishlist === overview` invariant test and the grep-based single-definition test both exist and pass.

**(F) Migration.** Additive-only and matches the schema exactly (verified above in SCW-Q1). Not applied, by design.

**(G) API auth + validation.** `GET` and `PUT /api/settings/scoring-weights` both call `getAuthenticatedUser()` and return its 401 error if unauthenticated (route.ts:13-14, 21-22). `PUT` validates each supplied weight (`validateGroup`, service lines 75-85) — negative or non-finite → `InvalidScoringWeightsError` → 400; malformed JSON → 400. The fundamentals route was migrated from its prior guard to `getAuthenticatedUser()` with the same 401 semantics — no auth regression. Route tests cover 401 (both verbs), 400-negative, 400-invalid-JSON, and the happy paths.

**(Security) IDOR / mass-assignment.** The one security-relevant spot — the preferences write — is safe. `saveWeights(auth.userId, ...)` derives `userId` from the session; the request body is destructured only into `composite`/`fundamental` (route.ts:31), so a body-supplied `userId` cannot redirect the write to another user's row. Mass-assignment is prevented structurally: `saveWeights` maps only whitelisted keys through `COMPOSITE_COLUMN_MAP`/`FUNDAMENTAL_COLUMN_MAP` (service lines 100-109); any extra body key is silently dropped and cannot reach a DB column. Weights are numbers (validated finite/non-negative), not a stored-XSS/injection vector; the settings page is a React client component rendering them as numbers with no `dangerouslySetInnerHTML`. The security-review skill run produced no HIGH/MEDIUM findings.

**Doc drift / test coverage (Step 3).** ADR-20 and ADR-21 are present, `accepted`, with accurate `Evidence` lines citing the real files/tests. `ARCHITECTURE.md` accurately describes the new table, the client-composite/server-fundamental split, the on-read-never-cached reweight, and the new key files. `AGENT.md` carries a detailed, accurate fragile-surface entry (single-source module, reweight-on-read-never-cached, the six-way Overview `isLoading` gate). Test coverage is thorough: the pure module (22 tests), the preferences service (8), the settings API route (6), the fundamental reweight fresh+cache paths incl. cache-not-rewritten (7), the wishlist weights incl. the single-definition grep and the wishlist==overview invariant (4). New functions/routes all have happy-path + failure-case tests. The settings PAGE has no component-level unit test — acceptable (no component harness exists in this project; its logic is thin over the tested service, and its behavior is covered by SCW-Q2's manual click-through).

**Standing checklist (Step 4).**
- Working tree clean — `git status --porcelain` empty; branch pushed (`git log @{u}..` empty). Pass.
- STATUS.md — 12 lines, links only, no narrative, no custom sections (the `Note:` line is a single link-style status line, within limits). Pass.
- Files conform to templates — ADR-20/21 match the ADR format; TECH_DEBT rows conform; schema/migration conform. Pass.
- Secrets — secret-scan clean; no keys/tokens in the diff; the new columns are numeric weights. Pass.
- Verify block — present in AGENT.md, single command, runs and passes (typecheck · lint · 193/193 · secret-scan). Pass.

## Proposed DECISIONS.md entries
None. ADR-20 and ADR-21 already capture the two decisions accurately (per-user table with discrete `Float?` columns / store-raw-normalize-at-read; and composite-client / fundamental-server split with the cache staying user-independent). No new ADR is warranted by this review.
