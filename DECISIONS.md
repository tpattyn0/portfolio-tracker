# DECISIONS.md

## ADR-1 — JWT session strategy over database sessions
- **Decision:** NextAuth with JWT sessions; `middleware.ts` authorises via `getToken()`, route handlers via `getServerSession()`.
- **Evidence:** `middleware.ts:6`, `lib/auth.ts:53-56`, `lib/utils/auth.ts:40`
- **Tradeoffs:** stateless and fast, no session table reads; but sessions cannot be revoked server-side, which raises the cost of the `NEXTAUTH_SECRET` exposure tracked in `TECH_DEBT.md` (leaked-secrets item).
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-2 — API routes authorise individually; middleware excludes /api
- **Decision:** `middleware.ts` matcher excludes `/api`, so every route handler calls `getAuthenticatedUser()` / `getAuthenticatedUserWithPortfolio()` or an inline `getServerSession()` check itself.
- **Evidence:** `middleware.ts:21-23` (matcher), `lib/utils/auth.ts`
- **Tradeoffs:** per-route control and clean public/private mixing; but a forgotten guard silently ships an open endpoint. Five routes were found unauthenticated during the 2026-07-16 onboarding audit and have since been fixed (see `reviews/2026-07-16-onboarding.md` ONB-04/ONB-05). Two guard patterns now coexist (shared helper vs. inline `getServerSession`) — see `AGENT.md` known fragile surfaces.
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-3 — Service layer between routes and Prisma
- **Decision:** business logic lives in `lib/services/*.service.ts`; route handlers stay thin and delegate.
- **Evidence:** `lib/services/` (9 services), `app/api/wishlist/[id]/route.ts:14` delegating to `wishlistService`
- **Tradeoffs:** testable and reusable logic; but ownership checks then live in the service (`wishlist.service.ts:113`), so a route that forgets to pass `userId` would bypass them.
- **Status:** accepted
- **Confidence:** High

## ADR-4 — In-process caching via node-cache and hand-rolled Maps
- **Decision:** no shared cache store; each service that caches does so independently — `node-cache` in `news.service.ts`, a separate `Map` in `market-data.service.ts`, another in `lib/middleware/rate-limit.ts`, plus 24h DB-backed caches on `FundamentalData`/`AnalystRating`.
- **Evidence:** `package.json` (`node-cache` dependency), `lib/services/market-data.service.ts`, `lib/services/news.service.ts`, `lib/middleware/rate-limit.ts:3`
- **Tradeoffs:** trivial to run locally, zero infra; but every cache is per-instance and lost on restart, won't be shared across serverless instances if deployed to a multi-instance target, and the rate limiter's effective limits are weaker than intended in that scenario.
- **Status:** accepted-but-flagged
- **Confidence:** Medium — inferred from usage; owner should confirm the deployment target before this is settled.

## ADR-5 — Closed positions are computed, not persisted
- **Decision:** there is no `ClosedPosition` model. `/api/portfolio/closed-positions` recomputes win/loss outcomes on every request via FIFO matching of `Transaction` rows.
- **Evidence:** `prisma/schema.prisma` (no `ClosedPosition` model), `app/api/portfolio/closed-positions/route.ts:27`
- **Tradeoffs:** no migration/backfill risk, always consistent with transaction history; but recomputes from scratch on every request with no caching, so cost grows with transaction history size, and the FIFO logic exists in exactly one place with no test coverage as of 2026-07-16.
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-6 — Dev and production share one database
- **Decision:** dev and production currently point at the same Supabase database. `.env`/`.env.local` hold two connection strings for it — one direct, one pooled — selected based on which network the developer is on, not which environment is running.
- **Evidence:** owner confirmation, 2026-07-16 (see `reviews/2026-07-16-onboarding.md` ONB-11); `.env`, `.env.local`
- **Tradeoffs:** simplest possible setup for a single-developer project; but any dev-side mutation (manual testing, a bad migration, a seed script) affects real user data with no isolation, and there is no way to test schema changes safely before they hit production.
- **Status:** accepted-but-flagged
- **Confidence:** High

## ADR-7 — Accept the leaked NEWS_API_KEY while non-production
- **Decision:** `NEWS_API_KEY` remains live and publicly readable in git history (commits `2a6c4c1a`, `3855042e`, in both `.env` and `.env.local`). The owner accepts this risk **conditional on this app not being in production**. `NEXTAUTH_SECRET`, `GEMINI_API_KEY`, and `DATABASE_URL` were rotated on 2026-07-17; this key was not, because newsapi.org's free tier exposes no regenerate or revoke control.
- **Evidence:** `lib/services/news.service.ts` (sole consumer); `TECH_DEBT.md` TD-01; `reviews/2026-07-16-onboarding.md` ONB-01. Leak verified by hashing the current `.env` against `3855042e:.env` — that check also confirms the other three are rotated.
- **Tradeoffs:** Anyone reading the public repo can spend this repo's NewsAPI quota, and the key cannot be revoked, so the exposure runs until a fresh key replaces it. Accepted because the blast radius is confined to a free-tier news quota: the key grants no access to our data, our users, or any account of value. This is explicitly *not* the reasoning that applied to `NEXTAUTH_SECRET`, which could forge sessions for any user and was rotated on that basis.
- **Condition (this is what makes the decision valid):** the app is not deployed. Going to production changes the calculus — a live app makes quota exhaustion a user-visible outage rather than a private annoyance. TD-01 therefore carries a blocking precondition: obtain a fresh NewsAPI key before any production deploy.
- **Supersedes:** the 2026-07-16 acceptance of ONB-01, which was made on the incorrect belief that the repo was a local-only clone. This one is made with the public exposure confirmed.
- **Status:** accepted-but-flagged
- **Confidence:** High (on the reasoning; the condition is the thing to watch — a decision conditional on "we won't deploy" silently expires the moment someone deploys)
