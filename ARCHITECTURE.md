# ARCHITECTURE.md

## Stack

- **Framework**: Next.js 15 (App Router), React 18.
- **Auth**: NextAuth v4, credentials provider (email/password, bcrypt), JWT session strategy (see `DECISIONS.md` ADR-1).
- **Database**: PostgreSQL (Supabase-hosted), accessed via Prisma.
- **Market data**: Yahoo Finance (`yahoo-finance2`), NewsAPI.
- **AI**: Google Gemini (`@google/generative-ai`) for news-sentiment scoring and daily portfolio insights.
- **UI**: Tailwind CSS, Radix UI primitives (via `components/ui/*`, shadcn-derived), two purpose-built inline-SVG charts — `components/portfolio-chart.tsx` (dashboard hero, see ADR-10; as of `plans/2026-07-18-meridian-dashboard-detail-fixes.md` also has hover crosshair+tooltip and y-axis price labels, ported from the detail chart's approach) and `components/research/detail-price-chart.tsx` (research-detail Overview/Technical charts, see ADR-11: hover crosshair+tooltip, minimal y-axis labels, optional dashed reference lines; no range-morph — the one behavior still exclusive to the detail chart, along with its variable viewBox). Recharts (`recharts` package) is no longer used anywhere in the app — `components/price-chart.tsx` was the last caller and was deleted once no importer remained (ADR-11); the dependency itself was removed from `package.json` 2026-07-18 (`plans/2026-07-18-performance-audit-remediation.md` Task 8, `TECH_DEBT.md` TD-30 Resolved). `next/font/google` (Libre Franklin, Newsreader — self-hosted), `next-themes` (light/dark persistence), `lucide-react` icons. `@tremor/react` was never the charting library and was removed from `package.json` in the same pass (TD-30). Design system: `DESIGN.md` (Meridian — see ADR-8/9/10/11/12).
- **Client state/data**: React Query for server-state caching; local `useState` elsewhere. (`zustand` was an unused dependency, removed 2026-07-18 — see `TECH_DEBT.md` TD-16 Resolved.) As of `plans/2026-07-18-performance-audit-remediation.md` (Task 1), the `QueryClient` in `components/providers.tsx` no longer sets a global `refetchInterval` — every query previously refetched every 30s regardless of staleness. Per-query `staleTime` is now the explicit knob (5min on research/wishlist reference-data queries, e.g. `technical-analysis.tsx`, `detail-price-chart.tsx`, the research-detail ownership query); portfolio price liveness is retained via `usePriceSync`'s own 5-min sync, not a global poll.
- **Caching**: in-memory (`node-cache` in `news.service.ts`; a separate hand-rolled `Map` in `market-data.service.ts`; another separate `Map` in `rate-limit.ts`; as of Task 3 above, a fourth keyed `Map` in `technical-analysis.service.ts` memoizing computed indicators per symbol, 60s TTL matching the underlying history cache) plus DB-backed 24h caches on `FundamentalData`/`AnalystRating`. No shared/external cache (e.g. Redis) — see ADR-4.

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
| `components/error-boundary.tsx` | `ErrorBoundary` (full-page, currently unused) and `ComponentErrorBoundary` (section-level, used on dashboard, position-detail, and research-detail pages) |
| `components/research/*` | Shared Meridian research-detail primitives (ADR-11): `headline-score-card.tsx`, `score-figure.tsx` (`ScoreFigure`/`VerdictStamp`), `subscore-band.tsx`, `graded-metric-row.tsx`, `detail-price-chart.tsx`, `transactions-tab.tsx`. Consumed by `overview.tsx`, `technical-analysis.tsx`, `fundamental-analysis.tsx`, `analyst-ratings.tsx`, `intrinsic-value.tsx`, `news-feed.tsx`. |
| `lib/utils/score-band.ts` | Pure score/metric-grade banding helpers (`scoreBandClass`, `gradingDotClass`, `metricGrade`) shared across the research-detail tabs — presentational only, never changes scoring math |
| `lib/utils/chart-ticks.ts` | Pure `niceYTicks()` helper for `DetailPriceChart`'s minimal y-axis labels |
| `lib/utils/research-scores.ts` | Pure `upsideToScore`/`sentimentToScore`/`round1` derivations shared by Overview, Intrinsic value, and News & sentiment tabs; `verdictLabel(score, context)` selects the composite-verdict label set (portfolio vs wishlist wording) — used by `overview.tsx`, whose own `context` prop is now driven by an ownership lookup in `research/[symbol]/page.tsx` rather than hardcoded (MRD-Q1) |

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
