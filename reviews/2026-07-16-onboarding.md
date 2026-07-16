# Review: onboarding audit (existing project)
Date: 2026-07-16
Status: [leave blank until implemented]

Audit target: branch `main` @ `bdbfad67` — working tree clean apart from tracked `.next/` build noise (see ONB-08).

## Summary
Findings: 1 BLOCKER, 6 ISSUEs, 2 SUGGESTIONs, 2 QUESTIONs
Requires owner decision: ONB-01 (URGENT — live secrets public on GitHub, rotate now), ONB-10, ONB-11
Ready for Coding agent: ONB-02, ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08, ONB-09

Scope note: this is a first-time onboarding audit, so the target is the whole codebase at HEAD rather than a single diff. The `security-review` skill was run as the Step 1 reference pass but produced no output — it diffs the working tree against HEAD, and the feature work is already committed in `bdbfad67`, leaving it nothing to analyse. The security pass below was therefore done manually against the code at HEAD.

## Findings

### ONB-01 — BLOCKER
**File:** git history — commits `2a6c4c1a`, `3855042e`, `c89e333d` (`.env`)
**Problem:** Three live credentials were committed in the repo's first commit and their values are **unchanged in the working `.env` today**: `NEXTAUTH_SECRET`, `NEWS_API_KEY`, `GEMINI_API_KEY`. Verified by hashing each value in `3855042e:.env` against the current file — all three match. (`DATABASE_URL` differs and appears already rotated.) `NEXTAUTH_SECRET` is the most serious: it signs NextAuth session JWTs, so anyone with repo history can forge a session for any user. `.gitignore` correctly covers `.env` now and the files are untracked at HEAD, so the leak was stopped going forward — but that fix never reached back into history, and `git check-ignore` passing today gives a false sense of safety.
**Aggravating factor — PUBLIC EXPOSURE CONFIRMED:** the repo has a remote (`github.com/tpattyn0/portfolio-tracker`) and `gh repo view` reports `"visibility":"PUBLIC"`. `git branch -r --contains 3855042e` confirms the secret-bearing commit is on `origin/main`. **All three credentials are publicly readable on GitHub and have been since the first commit.** Public repos are continuously scraped for credentials by automated tooling; assume these keys are already harvested rather than merely exposed.
**Owner decision (2026-07-16) — SUPERSEDED:** the owner elected to accept the risk, but did so on the basis of a reviewer error. An earlier check in the session misread `git log @{u}..` failing as "no remote configured" and the finding was presented as local-clone-only. That was wrong. The risk acceptance was made on false information and does not carry over to the corrected facts. Re-raised for a fresh decision.
**Recommendation:** rotate all three **now**, ahead of any other work in this repo: `NEXTAUTH_SECRET` via `openssl rand -base64 32`, and reissue the NewsAPI and Gemini keys from their consoles (the old ones should be revoked, not just replaced). `NEXTAUTH_SECRET` signs session JWTs and the app uses stateless JWT sessions (ADR-1), so anyone with the leaked value can forge a session for any user and existing sessions cannot be revoked server-side. Rotation is what closes the exposure. Consider also making the repo private and scrubbing history (`git filter-repo`), but neither substitutes for rotation — the values are already public. Per CLAUDE.md guardrail 7, a committed secret means rotate the key, not just delete the file.

### ONB-02 — ISSUE
**File:** `app/api/test-yahoo/route.ts:1-27`
**Problem:** Unauthenticated debug endpoint left in the app. It proxies a live Yahoo Finance `quoteSummary` call for a hardcoded `AAPL` and returns the raw upstream error message to the caller on failure (`error.message`, status 500). It serves no product purpose and gives an unauthenticated caller a free upstream-proxy probe plus internal error text.
**Recommendation:** delete the route. If a health check is genuinely wanted, replace it with one that does not proxy a third-party call and does not echo upstream error text.

### ONB-03 — ISSUE
**File:** `lib/middleware/rate-limit.ts`, `lib/middleware/csrf.ts`
**Problem:** Both modules exist but are imported by nothing (`grep -rl` across `app/` and `lib/` returns only the definitions). Security middleware that is written but never wired up is worse than absent, because the codebase reads as though the protection exists. Every route handler is currently unprotected by either.
**Recommendation:** either wire both into the routes that need them (rate limiting on the market/news/research routes that fan out to third-party APIs; CSRF on state-changing portfolio and wishlist routes) or delete them and record the gap in `TECH_DEBT.md`. Do not leave them dormant.

### ONB-04 — ISSUE
**File:** `app/api/sentiment/[symbol]/history/route.ts:1-35`
**Problem:** Unauthenticated route that reads directly from the database (`prisma.sentimentHistory.findMany`). The `middleware.ts` matcher excludes `/api`, so route handlers must authorise themselves and this one does not. The data is not user-scoped (sentiment is per-symbol, not per-user), so this is not a direct data-breach path — but it is an unauthenticated, unbounded DB read reachable by anyone. `days` is parsed with `parseInt` and never validated or clamped.
**Recommendation:** add `getAuthenticatedUser()` to match the pattern used by the other market routes, and validate/clamp `days` to a sane range.

### ONB-05 — ISSUE
**File:** `app/api/research/[symbol]/intrinsic-value/route.ts:1-40`, `app/api/news/[symbol]/route.ts:1-30`, `app/api/market/search/route.ts:1-30`
**Problem:** Three more unauthenticated routes. All three fan out to paid/rate-limited third-party services (Yahoo Finance, NewsAPI, and via the news path the Gemini sentiment analysis) on unauthenticated input. `news/[symbol]` also reads from the DB directly. The sibling market routes (`quote`, `chart`, `fundamentals`, `analyst-ratings`) all call `getAuthenticatedUser()`, so these are inconsistent with the codebase's own established pattern rather than a deliberate design.
**Recommendation:** add `getAuthenticatedUser()` to all three, matching the sibling market routes. If any is intentionally public, record that as an ADR in `DECISIONS.md` with the reasoning.

### ONB-06 — ISSUE
**File:** repo-wide — `package.json`
**Problem:** No `## Verify` block exists because there is nothing to put in it. There is no test runner, no test files anywhere (`*.test.*` / `*.spec.*` / jest / vitest configs all absent), no `typecheck` script, and no secret-scan step. `package.json` defines only `dev`/`build`/`start`/`lint` plus Prisma helpers. Per CLAUDE.md this means the Coding agent cannot verify its own work, and CI has nothing to run.
**Recommendation:** set up a test runner (vitest suits this stack), add a `typecheck` script (`tsc --noEmit`), wire in a secret scan (gitleaks), and define a single `## Verify` block in `AGENT.md` that runs all of them plus lint. This is the prerequisite for every future Coding agent session.

### ONB-07 — ISSUE
**File:** repo-wide
**Problem:** Zero test coverage across ~30 API routes and 8 services, including the financial logic that is the core of the product — `intrinsic-value.service.ts`, `technical-analysis.service.ts`, `fundamental-analysis.service.ts`, and the buy/sell position mutation paths. Miscalculation here is silent and directly wrong for the user.
**Recommendation:** do not attempt a full retrofit — per CLAUDE.md that is a separate task for the Planner to scope. Once ONB-06 lands, write tests for code touched in each subsequent session, and have the Planner scope a backfill prioritising the financial services and the buy/sell mutation paths.

### ONB-08 — ISSUE
**File:** `.next/` (tracked), `.gitignore:12`
**Problem:** `.next/` is listed in `.gitignore` but is tracked in git, so the ignore rule has no effect on it — files already tracked are not affected by `.gitignore`. This produces 207 permanent entries in `git status`, which is what caused the review target to be misread at the start of this session (see Workflow feedback). It also means build artefacts land in every diff.
**Recommendation:** `git rm -r --cached .next` and commit. The `.gitignore` entry is already correct and will take effect once the files are untracked.

### ONB-09 — ISSUE
**File:** `PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `AGENT.md`, `TECH_DEBT.md`, `STATUS.md`, `GTM.md`, `DESIGN.md`, `future_ideas.md`, `plans/`
**Problem:** None of the framework files required by CLAUDE.md exist. There is no ADR log, so the non-obvious decisions visible in the code (JWT sessions over DB sessions, service-layer split, `node-cache` for market data, Prisma+Supabase) are undocumented. `IMPROVEMENTS.md` and `docs/` hold real content but sit outside the framework structure.
**Recommendation:** create the derivable files from the code in a Coding agent session — `PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `AGENT.md`, `TECH_DEBT.md`. Create `GTM.md`, `DESIGN.md`, and `future_ideas.md` as `[REQUIRES INPUT]` stubs — they need business and design decisions that must not be invented. Proposed ADR seeds are listed at the bottom of this file. Fold `IMPROVEMENTS.md` into `TECH_DEBT.md` where its items still apply.

### ONB-10 — QUESTION
**File:** `docs/` — `Fundamental_Analysis_Functional_Specification.md`, `Technical-Analysis-Functional-Description.md`, plus PDFs
**Problem:** `docs/` contains functional specifications that predate the framework and overlap with what `PRODUCT.md` should own. I have not verified the specs against the implementation, so I cannot say whether they describe built reality or intent. Per CLAUDE.md, if a doc claims something is implemented and the code does not confirm it, the doc is wrong — but confirming that here is a substantial audit in its own right.
**Recommendation:** owner to confirm whether `docs/` is (a) authoritative spec to be reconciled into `PRODUCT.md`, (b) historical reference to leave alone, or (c) stale and to be removed. Cheapest path is (b) plus a pointer from `PRODUCT.md`.

### ONB-11 — QUESTION
**File:** `.env`, `.env.local`, `next.config.js`
**Problem:** `.env` and `.env.local` are byte-identical in their secret values, and `DATABASE_URL` in both has one Supabase connection string commented out and another active — suggesting dev and production point at the same or manually-swapped databases. CLAUDE.md requires confirming dev/production separation. I cannot determine from the files alone which environment each string targets.
**Recommendation:** owner to confirm whether dev and production use separate databases. If they share one, that is a data-integrity risk worth an ADR and a follow-up plan.

### ONB-12 — SUGGESTION
**File:** `app/api/portfolio/positions/[ticker]/sell/route.ts:28-39`, `lib/services/wishlist.service.ts:110-156`, `lib/utils/auth.ts`
**Problem:** Not a defect — worth recording as a strength so it is not regressed. Ownership scoping is done correctly and consistently: `getAuthenticatedUserWithPortfolio()` derives `portfolioId` from the session, position lookups are scoped by the compound `portfolioId_ticker` key, and wishlist mutations gate on a `findFirst` scoped to the user's own wishlist before writing. I probed specifically for IDOR on the `[id]` and `[ticker]` routes and found none.
**Recommendation:** capture this pattern in `AGENT.md` under conventions, so future routes follow it and a reviewer can spot deviation quickly.

### ONB-13 — SUGGESTION
**File:** `app/api/auth/register/route.ts:6-30`
**Problem:** Registration is soundly built (Zod validation, bcrypt at cost 10, no password echoed back) but is unauthenticated by necessity and has no rate limiting — and `lib/middleware/rate-limit.ts` already exists unused (ONB-03). This is the single most valuable place to wire it in.
**Recommendation:** when resolving ONB-03, treat `/api/auth/register` as the first consumer.

## Proposed DECISIONS.md entries

These are seeds for the Coding agent to complete when creating `DECISIONS.md` (ONB-09). Evidence lines are cited from HEAD; confidence reflects how clearly the intent is readable from code alone.

## ADR-1 — JWT session strategy over database sessions
- **Decision:** NextAuth with JWT sessions; `middleware.ts` authorises via `getToken()`, route handlers via `getServerSession()`.
- **Evidence:** `middleware.ts:6`, `lib/auth.ts`, `lib/utils/auth.ts:40`
- **Tradeoffs:** stateless and fast, no session table reads; but sessions cannot be revoked server-side, which raises the cost of the `NEXTAUTH_SECRET` exposure in ONB-01.
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-2 — API routes authorise individually; middleware excludes /api
- **Decision:** `middleware.ts` matcher excludes `/api`, so every route handler calls `getAuthenticatedUser()` / `getAuthenticatedUserWithPortfolio()` itself.
- **Evidence:** `middleware.ts:22` (matcher), `lib/utils/auth.ts`
- **Tradeoffs:** per-route control and clean public/private mixing; but a forgotten guard silently ships an open endpoint — which is exactly ONB-04 and ONB-05, five routes with no guard.
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-3 — Service layer between routes and Prisma
- **Decision:** business logic lives in `lib/services/*.service.ts`; route handlers stay thin and delegate.
- **Evidence:** `lib/services/` (8 services), `app/api/wishlist/[id]/route.ts:14` delegating to `wishlistService`
- **Tradeoffs:** testable and reusable logic; but ownership checks then live in the service (`wishlist.service.ts:113`), so a route that forgets to pass `userId` would bypass them.
- **Status:** accepted
- **Confidence:** High

## ADR-4 — In-process caching via node-cache
- **Decision:** `node-cache` for market data caching rather than a shared store.
- **Evidence:** `package.json` (`node-cache` dependency), `lib/services/market-data.service.ts`
- **Tradeoffs:** trivial to run locally; but cache is per-instance and lost on restart, and will not be shared across serverless instances if deployed to Vercel.
- **Status:** accepted-but-flagged
- **Confidence:** Medium — inferred from usage; owner should confirm the deployment target before this is settled.
