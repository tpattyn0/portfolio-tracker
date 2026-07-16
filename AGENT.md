# AGENT.md — portfolio-tracker
> Project-specific conventions and constraints. Generic guardrails are in `CLAUDE.md` — not here.

## Conventions

- **Route handlers stay thin, delegate to `lib/services/*.service.ts`** (ADR-3). Don't put business logic directly in `app/api/**/route.ts`.
- **Auth guard pattern for new routes:** prefer `getAuthenticatedUser()` / `getAuthenticatedUserWithPortfolio()` from `lib/utils/auth.ts` over inlining `getServerSession(authOptions)` + a manual 401 — the shared helper is the single source of truth if the auth check ever changes. (An inline variant exists on 7 older routes; don't propagate it further.)
- **Ownership scoping is done correctly and consistently** — `getAuthenticatedUserWithPortfolio()` derives `portfolioId` from the session, position lookups are scoped by the compound `portfolioId_ticker` key, and wishlist mutations gate on a `findFirst` scoped to the user's own wishlist before writing (`app/api/portfolio/positions/[ticker]/sell/route.ts:28-39`, `lib/services/wishlist.service.ts:110-156`). Follow this pattern for any new mutation route; a reviewer should treat a route that skips it as a deviation worth flagging.
- **Rate limiting:** use `checkRateLimit(request, scope, maxAttempts, windowMs)` from `lib/middleware/rate-limit.ts` for unauthenticated or third-party-fanout routes. It's in-memory and per-instance (see fragile surfaces) — fine for now, revisit if deployed multi-instance.
- **Financial calculation services** (`intrinsic-value.service.ts`, `technical-analysis.service.ts`, `fundamental-analysis.service.ts`) are pure/static-method classes reading from cached DB tables or live Yahoo data. Keep them side-effect-free where possible; persistence/caching happens in the route or a thin wrapper, not buried inside the calculation itself.

## Known fragile surfaces

- **`lib/env.ts` and `lib/utils/env.ts` are both dead code** — neither is imported anywhere. Both validate `GOOGLE_API_KEY`, but the actual runtime env var is `GEMINI_API_KEY` (`lib/services/sentiment.service.ts:18-21`, `app/api/insights/portfolio/route.ts:46`). Do not wire either up without fixing the variable name first — doing so naively would validate the wrong key and could pass validation while Gemini silently fails.
- **`lib/services/sentiment.service.ts:17-22,190`** — the service constructor throws if `GEMINI_API_KEY` is unset, and a singleton instance is created at module scope. Importing this module anywhere without the env var set crashes at import time, not call time. Be careful adding new imports of this module in code paths that might run without the key configured (e.g. build-time static analysis, scripts).
- **`lib/services/wishlist.service.ts` makes self-referential HTTP calls** (around lines 230, 242) to its own `/api/news/[symbol]` and `/api/research/[symbol]/intrinsic-value` routes via `fetch(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' ...)` instead of calling the underlying services directly. This silently falls back to `localhost` if `NEXT_PUBLIC_APP_URL` isn't set, runs from a server context with no forwarded user session, and re-triggers that route's own auth/rate-limit checks. If wishlist composite scores seem wrong or slow, check this path first.
- **`lib/services/fundamental-analysis.service.ts:78`** — cache freshness is gated partly by a hardcoded `latestMigrationDate` literal tied to a past scoring-logic change. Any future change to extraction/scoring logic needs this date bumped, or stale cached data will be served past the normal 24h TTL.
- **Two independent Gemini client instantiations** — `sentiment.service.ts` (`gemini-1.5-flash`, no fallback) and `app/api/insights/portfolio/route.ts` (`gemini-1.5-pro` → `gemini-pro` fallback) each construct their own `GoogleGenerativeAI` client with different model choices. Keep this in mind if Gemini behavior needs to change — it must change in both places.
- **`IndustryComparison` table is read but never written** — `intrinsic-value.service.ts` reads it for peer-relative valuation but nothing populates it, so those methods fall back to hardcoded defaults (`industryPE = 15`, `industryPB = 1.5`). If this table is ever seeded, re-verify the fallback logic still behaves correctly.
- **`app/api/portfolio/closed-positions/route.ts`** — FIFO transaction-matching logic exists in exactly one place with no test coverage as of 2026-07-16 and recomputes on every request (no caching). Treat changes here carefully; a bug is a silent wrong number shown to the user (win rate, realized P/L).
- **`ComponentErrorBoundary` coverage is inconsistent** — only wraps sections on `dashboard/page.tsx` and `portfolio/[ticker]/page.tsx`. `research/[symbol]/page.tsx`, `research/page.tsx`, `wishlist/page.tsx`, `portfolio/add/page.tsx`, and `portfolio/closed-positions/page.tsx` have no boundary around components that depend on external API calls. A runtime error there crashes the whole page. `components/error-boundary.tsx` also exports a full-page `ErrorBoundary` class that is never used anywhere, including `app/layout.tsx`.
- **`research/[symbol]/page.tsx` doesn't use React Query** unlike every other data-fetching page — it fetches via a manual `useEffect` + `fetch`, missing caching/refetch-on-focus/shared invalidation that the rest of the app relies on.
- **`.next/` was tracked in git until 2026-07-16** — if you ever see hundreds of unrelated `.next/*` diffs in `git status`, someone re-added it; re-run `git rm -r --cached .next`. Do not `git add -A` in this repo.

## Hard limits

- Dev and production share one database (ADR-6) — be extra cautious with any destructive script, seed, or migration; there is no isolated dev DB to test against yet.
- Do not wire up `lib/middleware/csrf.ts`-style CSRF protection without also building a token-issuance flow — a prior version of this file was deleted as dead code because the cookie it expected was never set anywhere (see `TECH_DEBT.md`).

## Verify

Single command, run before every commit:

```bash
npm run verify
```

This runs, in order: `typecheck` (`tsc --noEmit`), `lint` (`next lint`), `test` (`vitest run`), and `secret-scan` (`gitleaks detect --source . --no-git -c .gitleaks.toml --redact`). All four must pass. `lint` currently has pre-existing warnings (unused imports, a few `any` types) that do not fail the command — do not treat fixing all of them as in-scope for an unrelated change; fix only what you touch.

### Reading CI on a PR

Two checks, and only one of them blocks:

| Check | Blocks merge? | What a red means |
|---|---|---|
| `verify / code-gate` | **Yes — required** | A real failure. Typecheck, lint, tests, or a secret in *this PR's* commits. |
| `verify / secret-history (reporting only — expected red)` | No | **Expected.** It reports the known historical leak (ADR-7 / TD-01). It is red on every run and will stay red until TD-01 is fully resolved. |

So a PR showing one red X and one green is **normal**. Two reds means `code-gate` failed and something is actually wrong. These were previously both named `verify`, which made a real failure indistinguishable from the expected one at a glance — renamed 2026-07-17.

**CI runs `npm run verify:code`, not `npm run verify`** — same typecheck + lint + test gate, minus the local secret scan. CI handles secrets in its own steps instead: `code-gate` scans this PR's commit range, and `secret-history` scans all of history. Neither uses the gitleaks GitHub Action — on a `pull_request` event it only scans the PR's own commits and ignores `fetch-depth`, which is how a green check once coexisted with three live secrets in the first commit. Keep the two in sync: a check added to `verify` belongs in `verify:code` too.

## Git hooks live in `.githooks/`, not `hooks/`

`hooks/` is application source (React hooks — `use-debounce`, `use-price-sync`, `use-toast`), imported as `@/hooks/*` across `app/` and `components/`. The workflow framework's rollout script defaults to putting `pre-commit` and `install.sh` in a root `hooks/` directory; in this repo they were moved to `.githooks/` to keep shell scripts out of a source tree.

Install them on a fresh clone with `bash .githooks/install.sh` (**not** `bash hooks/install.sh`, which HUMAN_GUIDE §12 states as the generic command). Git hooks live in `.git/hooks/` and never survive a clone, so this is a per-clone step.

