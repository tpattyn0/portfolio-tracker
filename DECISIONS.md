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
- **Decision:** dev and production currently point at the same Supabase database. `.env`/`.env.local` hold two connection strings for it, used simultaneously for different purposes: `DATABASE_URL` (transaction-mode pooler, port 6543) for the running app, `DIRECT_URL` (session-mode pooler, port 5432) for `prisma migrate`/`prisma db push`. (An earlier version of this entry described the two strings as selected based on which network the developer is on — that described the pre-reconnect Supabase project, not the current one; corrected 2026-07-17 per AUD-01.)
- **Evidence:** owner confirmation, 2026-07-16 (see `reviews/2026-07-16-onboarding.md` ONB-11); `.env`, `.env.local`, `.env.example`, `prisma/schema.prisma:7,10`
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

## ADR-8 — Meridian tokens replace the shadcn HSL-triple values in place; drop the `hsl()` wrapper
- **Decision:** one token system, not two. Meridian's palette is written directly into the existing shadcn variable names in `app/globals.css` (`--background`, `--card`, `--border`, `--foreground`, …), with Meridian-only tokens (`--ink`, `--sub`, `--mut`, `--line2`, `--fill`, `--up`, `--dn`, `--amber`, `--btnbg`, `--btnfg`) added alongside. The `hsl(var(--x))` wrapper is removed from `tailwind.config.js` so variables hold complete colors (hex/oklch) rather than bare HSL triples. The theme switch stays on `darkMode: ["class"]` / `.dark` — the design's `data-theme="dark"` is a prototype artifact, and swapping the mechanism changes nothing visually while costing a custom Tailwind variant.
- **Rationale (both facts verified against this codebase, 2026-07-17):** (1) `hsl()` cannot parse hex or oklch — `hsl(#faf8f4)` and `hsl(oklch(...))` are invalid CSS, so keeping the wrapper would force lossy HSL conversion of exactly the three oklch accents (`--up`/`--dn`/`--amber`) that carry gain/loss meaning. (2) The wrapper exists in exactly one file: `grep -rE 'hsl\(var\(--' components/ui/*.tsx` returns **nothing** — all 20 UI components consume Tailwind aliases (`bg-card`, `border-border`) that `tailwind.config.js` resolves. So one file's change reskins all 20 components, Radix primitives included, with zero component edits.
- **Evidence:** not-implemented — planned in `plans/2026-07-17-meridian-design-overhaul.md` Task 1. On implementation: `tailwind.config.js` (colors), `app/globals.css` (`:root`/`.dark`).
- **Tradeoffs:** the Tailwind color config diverges from the stock shadcn idiom, so future `npx shadcn add` output will arrive expecting `hsl(var(--x))` and needs its color values adjusted (mitigated by an `AGENT.md` fragile-surface entry). Opacity modifiers (`bg-card/50`) still work — Tailwind emits `color-mix()` for non-HSL vars. Rejected alternatives: a parallel token set (two palettes to sync forever; guarantees drift), and converting Meridian to HSL triples (lossy on the oklch accents; permanently blocks the design's color space).
- **Status:** proposed
- **Confidence:** High — the two load-bearing facts were verified empirically rather than recalled.

## ADR-9 — "Watchlist" is user-visible copy only; code and schema stay `wishlist`
- **Decision:** the Meridian design's "Watchlist" is adopted in UI copy (nav label, H1, buttons). The route (`/wishlist`), component files, `wishlist.service.ts`, the API routes, and the Prisma `Wishlist`/`WishlistItem` models keep the `wishlist` name.
- **Evidence:** not-implemented — planned in `plans/2026-07-17-meridian-design-overhaul.md` Task 8.
- **Tradeoffs:** copy and code disagree, which is a real papercut for anyone navigating the codebase from the UI. Accepted because the alternative — renaming models — is a migration against a database that dev and prod **share** (ADR-6): real risk of data loss, zero visual payoff, and squarely outside a re-skin's scope. "Watchlist" is also the more accurate domain term (and the term `PRODUCT.md` already uses in prose), so the copy change is a correction, not a rebrand. Logged in `TECH_DEBT.md` for a future dedicated rename.
- **Status:** proposed
- **Confidence:** High

## ADR-10 — Purpose-built inline SVG for the dashboard chart; Recharts retained elsewhere
- **Decision:** `components/portfolio-chart.tsx` is rewritten as an inline SVG area chart using a ported Catmull-Rom→bezier path builder (`lib/utils/chart-path.ts`) plus a 500ms eased `requestAnimationFrame` morph on range change. `components/price-chart.tsx` (research detail) keeps Recharts and is retokenized only.
- **Correction of record:** `ARCHITECTURE.md` listed Tremor as the charting library. It is a dependency with **zero imports** — `grep -rn "@tremor/react" app components` returns nothing. Both charts are and were Recharts. `ARCHITECTURE.md` is corrected and the unused dependency logged as debt.
- **Rationale:** the design is declared high-fidelity, and its two headline chart behaviors are precisely what Recharts does not do — `type="monotone"` is monotone-cubic interpolation (deliberately overshoot-suppressing), not Catmull-Rom; and Recharts re-renders on data change rather than interpolating between two series. The prototype already contains a complete ~10-line implementation of both. The custom SVG is *less* code than the Recharts usage it replaces.
- **Evidence:** not-implemented — planned in `plans/2026-07-17-meridian-design-overhaul.md` Task 6.
- **Tradeoffs:** gives up Recharts' tooltips/axis autoscaling on the dashboard chart, and hand-rolled SVG means we own the edge cases (degenerate/flat/empty series) — mitigated by unit-testing `buildPath` directly, which is cheaper and higher-signal than any test of the Recharts version would have been. Confined to one component deliberately: `price-chart.tsx` keeps Recharts because its axes and tooltips are worth more there than pixel-parity.
- **Status:** proposed
- **Confidence:** Medium — the path math is verified against the prototype, but "matches the design pixel-for-pixel" is confirmable only by eye during implementation.
