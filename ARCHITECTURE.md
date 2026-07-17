# ARCHITECTURE.md

## Stack

- **Framework**: Next.js 15 (App Router), React 18.
- **Auth**: NextAuth v4, credentials provider (email/password, bcrypt), JWT session strategy (see `DECISIONS.md` ADR-1).
- **Database**: PostgreSQL (Supabase-hosted), accessed via Prisma.
- **Market data**: Yahoo Finance (`yahoo-finance2`), NewsAPI.
- **AI**: Google Gemini (`@google/generative-ai`) for news-sentiment scoring and daily portfolio insights.
- **UI**: Tailwind CSS, Radix UI primitives, Tremor (charts), Recharts, `lucide-react` icons.
- **Client state/data**: React Query for server-state caching; local `useState` elsewhere. (`zustand` is a dependency but unused — see `TECH_DEBT.md`.)
- **Caching**: in-memory (`node-cache` in `news.service.ts`; a separate hand-rolled `Map` in `market-data.service.ts`; another separate `Map` in `rate-limit.ts`) plus DB-backed 24h caches on `FundamentalData`/`AnalystRating`. No shared/external cache (e.g. Redis) — see ADR-4.

## Request flow

1. `middleware.ts` gates all page routes (not `/api/*`) using NextAuth's `getToken()` — unauthenticated users are redirected to `/login`; authenticated users on `/login`/`/register` are redirected to `/dashboard`.
2. Every `/api/*` route handler authorises itself — either via the shared helpers in `lib/utils/auth.ts` (`getAuthenticatedUser()`, `getAuthenticatedUserWithPortfolio()`) or an inline `getServerSession(authOptions)` check (see ADR-2 and `AGENT.md` fragile surfaces for the inconsistency between the two patterns).
3. Route handlers delegate business logic to `lib/services/*.service.ts` (see ADR-3); routes stay thin.
4. Services call Prisma for persistence/caching and external APIs (Yahoo Finance, NewsAPI, Gemini) for live data.

## Data model (`prisma/schema.prisma`)

- `User` 1:1 `Portfolio`, 1:1 `Wishlist`, 1:many `PortfolioInsight`.
- `Portfolio` 1:many `Position`, 1:many `Transaction`.
- `Position` 1:many `Transaction` (nullable `positionId` FK).
- `Wishlist` 1:many `WishlistItem`.
- Symbol-keyed, user-independent shared market-data cache tables: `FundamentalData`, `AnalystRating`, `IndustryComparison`, `NewsArticle`, `SentimentHistory`.
- No `ClosedPosition` model — closed positions are computed on every request via FIFO matching of `Transaction` rows (`app/api/portfolio/closed-positions/route.ts`).

## Key files

| File | Role |
|---|---|
| `middleware.ts` | Page-route auth gate (excludes `/api`) |
| `lib/auth.ts` | NextAuth config — credentials provider, JWT callbacks |
| `lib/utils/auth.ts` | Shared route-handler auth helpers (`getAuthenticatedUser`, `getAuthenticatedUserWithPortfolio`) |
| `lib/prisma.ts` | Prisma client singleton (cached on `globalThis` outside production) |
| `lib/yahoo-finance.ts` | Shared `yahoo-finance2` client instance |
| `lib/middleware/rate-limit.ts` | Per-IP, per-scope in-memory rate limiter (`checkRateLimit`) |
| `lib/services/technical-analysis.service.ts` | Core calc: technical indicators → signal/score (largest service, 732 lines) |
| `lib/services/fundamental-analysis.service.ts` | Core calc: fundamentals extraction + scoring (638 lines) |
| `lib/services/intrinsic-value.service.ts` | Core calc: DCF/Graham/PEG/multiples → fair value (330 lines) |
| `lib/services/wishlist.service.ts` | Wishlist CRUD + composite score aggregation |
| `lib/services/news.service.ts` | News aggregation (Yahoo + NewsAPI), relevance scoring |
| `lib/services/sentiment.service.ts` | Gemini-based article sentiment scoring + daily aggregation |
| `lib/services/analyst-ratings.service.ts` | Analyst rating fetch + scoring |
| `lib/services/exchange-rate.service.ts` | FX rate fetch/cache/convert |
| `components/error-boundary.tsx` | `ErrorBoundary` (full-page, currently unused) and `ComponentErrorBoundary` (section-level, used on dashboard and position-detail pages only) |

## API surface

23 route files under `app/api`. See `AGENT.md` conventions for the auth-guard pattern new routes should follow. Full enumeration is not duplicated here — read `app/api/**/route.ts` directly; the tree is shallow and each file is short.

Two routes are intentionally public, with no auth guard — every other route requires an authenticated session:
- `api/auth/[...nextauth]` — the NextAuth handler itself; it *is* the auth mechanism, so it can't require a session.
- `api/auth/register` — new-account creation; a session can't exist yet at registration time.

## Environment separation

Dev and production currently point at the same Supabase database (confirmed by the owner, 2026-07-16) — this is a single-instance limitation, not separate dev/prod instances. See `TECH_DEBT.md` (TD-02).

`DATABASE_URL` and `DIRECT_URL` are two connection strings to that *same* database, serving different purposes simultaneously (not selected by network, as an earlier version of this doc stated — see ADR-6):
- `DATABASE_URL` — transaction-mode pooler (port 6543, `pgbouncer=true`), used by Prisma Client at runtime.
- `DIRECT_URL` — session-mode pooler (port 5432), required by `prisma migrate`/`prisma db push`, which need prepared-statement support that transaction-mode pooling doesn't provide.

Both must be set in `.env`/`.env.local` (see `.env.example`) or migrations will fail on a fresh clone.
