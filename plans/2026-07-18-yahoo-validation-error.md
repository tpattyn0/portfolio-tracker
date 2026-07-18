# Plan: Yahoo quoteSummary schema-validation resilience
Date: 2026-07-18

## Problem

Fundamental analysis is broken with `FailedYahooValidationError: Failed Yahoo Schema
validation`, thrown out of `FundamentalAnalysisService.fetchFundamentals`
(`lib/services/fundamental-analysis.service.ts:90`) and surfaced as a 500 by
`app/api/market/fundamentals/[symbol]/route.ts`. No app-side code changed — Yahoo
changed the shape of its `quoteSummary` response (a new/renamed field or an
unexpected type), and `yahoo-finance2` v3 validates every response against a frozen
Zod schema **by default**, so it throws even though the underlying data is usually
still present and usable. This is a recurring, documented failure mode of the
library: any Yahoo payload drift re-breaks the app until the library ships an
updated schema.

The same exposure exists at **all three** `quoteSummary` call sites, not just the
one in the trace — a durable fix must cover the shared pattern, not patch one method:

- `lib/services/fundamental-analysis.service.ts:90` — modules: `price`, `summaryDetail`, `defaultKeyStatistics`, `financialData`, `cashflowStatementHistory`, `earningsHistory`, `earningsTrend`, `upgradeDowngradeHistory`, `recommendationTrend`.
- `lib/services/market-data.service.ts:52` — modules: `price`, `summaryDetail` (drives every live quote; the highest-blast-radius site).
- `lib/services/analyst-ratings.service.ts:50` — modules: `financialData`, `recommendationTrend`, `upgradeDowngradeHistory`, `earningsTrend`.

(`news.service.ts` and `wishlist.service.ts` import the client but use `quote`/
`search`/`historical`, not `quoteSummary` — out of scope, though the wrapper's
existence guards them if they later adopt `quoteSummary`.)

## Approach

### Chosen remedy: keep validation ON, catch by name, warn, use the coerced `error.result`

Of the two library-sanctioned remedies, this plan uses a **hybrid** applied through a
single shared wrapper:

- **Not blanket `{ validateResult: false }` (remedy B):** disabling validation
  entirely silences the drift signal. We would never know Yahoo changed its payload
  until a downstream number looked wrong — the opposite of what AGENT.md's "a wrong
  number is silent and directly harms the user" rule demands. The library itself
  recommends against globally disabling validation.
- **Chosen — remedy A, with observability:** let the library validate; catch the
  throw; on a validation error, log a **warning** (the drift signal, one line per
  drift with the offending field paths from `error.errors`) and return
  `error.result` — the partially-validated / coerced payload the library already
  computed (Zod coercion that *did* pass, e.g. Date parsing, is retained). Any other
  error re-throws unchanged.

**Detection mechanism — by `error.name`, not `instanceof`.** Verified against the
installed `yahoo-finance2@3.13.0`: the package's `exports` map does **not** expose an
`errors` subpath, the constructed instance does **not** carry an `errors` property,
and the package root does not re-export the error classes. So the older-doc pattern
`error instanceof yahooFinance.errors.FailedYahooValidationError` does not work here,
and deep-importing `yahoo-finance2/esm/src/lib/errors.js` would violate the exports
map and break under Next.js bundling. The `FailedYahooValidationError` class sets
`this.name = "FailedYahooValidationError"` (verified in `errors.js`) and exposes
`.result` and `.errors` — so `error instanceof Error && error.name ===
"FailedYahooValidationError"` is the robust, bundling-safe check, and `error.result`
/ `error.errors` are read off it. This detail is load-bearing; the wrapper must not
use `instanceof` against a library error class.

### Where: one shared wrapper in `lib/yahoo-finance.ts`

Add `safeQuoteSummary(symbol, queryOptions)` to `lib/yahoo-finance.ts` (co-located
with the shared client). All three services call it instead of
`yahooFinance.quoteSummary(...)` directly. Rationale:

- A single chokepoint means a **fourth** future call site can't silently regress —
  it uses the wrapper by convention (enforced by an AGENT.md fragile-surface entry
  and by the wrapper being the obvious import).
- Tradeoff accepted: the wrapper's return type is `unknown` (the coerced result is
  untyped once we tolerate partial/failed validation), so callers do their own
  shape-guarding. This is a real change to the return-type contract — but the three
  extractors (`extractMetrics`, `extractRatings`, and `getQuote`'s field reads)
  **already** treat the response as `Record<string, any>` with heavy `data.x || {}`
  / `?.` null-guarding, so the shape-guarding burden already lives caller-side. The
  wrapper types its return as `Record<string, unknown>` (or `any`, matching the
  existing extractor signatures) to keep the diff to the call line only.

### Guarding against silently returning garbage — fail loud vs degrade gracefully

The danger is not partial data per se (the extractors already null-guard and the
scoring already substitutes a neutral 5 per *missing dimension* — documented,
intended graceful-degrade behavior). The danger is returning a payload so broken
that the result is meaningless while *looking* valid. The wrapper draws the line:

- **Wrapper level (shared):** if a validation error fires but `error.result` is
  null/undefined (nothing to fall back to), **re-throw** — there is no usable data,
  so the route's existing 500/handling must stand rather than passing `null`
  downstream.
- **Call-site level (per service, because "critical" differs):** after the wrapper
  returns, each service asserts the *module it structurally depends on* is present
  before extracting, and throws a clear error if not:
  - `market-data.service.ts` already does this — `if (!quote || !quote.price) throw` —
    keep it; it is exactly the right guard (a quote with no `price` module is
    unusable). No new guard needed beyond confirming it still fires post-wrapper.
  - `fundamental-analysis.service.ts` — add a guard that the response is a non-null
    object with at least the `price` **or** `summaryDetail` module present (the
    minimum needed for any valuation metric). If neither is present, throw — do not
    persist a row of all-null metrics scored as a misleading neutral 5 and cache it
    for 24h. Missing *individual* metrics still degrade gracefully as today.
  - `analyst-ratings.service.ts` — a missing `recommendationTrend` legitimately means
    "no analyst coverage" and the extractor already returns `totalAnalysts: 0` →
    neutral score 5 (documented behavior). So here, **do not** add a hard throw on a
    missing module; only rely on the wrapper's null-`result` re-throw. Document this
    asymmetry in the plan so the Coding agent doesn't over-apply the fundamentals
    guard here.

This keeps the failure modes honest: total-garbage → loud error (500, existing
behavior); one drifted field → warn + coerced partial + graceful per-metric
degrade; genuinely-absent optional data (no analyst coverage) → the existing neutral
path, unchanged.

### Observability (the recurring-drift angle)

The wrapper's warning log includes the symbol, the module set requested, and the
validation error's field paths (`error.errors`, mapped to their `instancePath` /
message). This is the signal that Yahoo drifted — it turns a silent recurring
breakage into a greppable warning, and it is the trigger to bump the
`yahoo-finance2` dependency (whose newer schema will re-validate cleanly). Log at
`console.warn` to match the codebase's existing `console.error`/`console.warn`
convention (no logger abstraction exists).

### Explicitly out of scope

- **TD-11 / `latestMigrationDate` (`fundamental-analysis.service.ts:78`):** adjacent
  but independent. The validation fix does not touch cache-freshness gating, and the
  two do not interact — a validation failure happens on the *fresh fetch* path,
  which only runs when the cache is already stale/absent. Not scoped in; left as the
  existing TECH_DEBT item.
- **Changing scoring math, weights, or thresholds** — untouched. This is a
  data-plumbing resilience fix, not a scoring change.
- **A logger abstraction / structured logging** — use `console.warn`, matching
  existing convention.

## Tasks

1. [ ] Add `safeQuoteSummary(symbol, queryOptions)` to `lib/yahoo-finance.ts`: call
   `yahooFinance.quoteSummary(symbol, queryOptions)` inside try/catch; on
   `error instanceof Error && error.name === "FailedYahooValidationError"` with a
   non-null `.result`, `console.warn` a one-line drift message including the symbol,
   the requested modules, and the mapped `error.errors` field paths, then return
   `error.result`; if `.result` is null/undefined, re-throw; re-throw all other
   errors unchanged. Export it alongside the default client.
   — Acceptance: unit test (Task 5) proves it returns `error.result` on a
   name-matched validation error, re-throws when `.result` is nullish, and re-throws
   a non-validation error; `npm run verify` typechecks the new export.

2. [ ] Route `fundamental-analysis.service.ts:90` through `safeQuoteSummary`; add the
   "no `price` and no `summaryDetail` module" guard that throws before
   `extractMetrics`/`saveToDatabase` so an all-null row is never persisted or cached.
   — Acceptance: unit test feeds a mocked validation error whose `error.result` has a
   populated `price` module and asserts `fetchFundamentals` returns usable metrics
   (not a throw); a second test with an empty `error.result` asserts it throws and
   `saveToDatabase` is not called.

3. [ ] Route `market-data.service.ts:52` through `safeQuoteSummary`; confirm the
   existing `if (!quote || !quote.price) throw` guard still fires against the
   wrapper's return.
   — Acceptance: unit test with a mocked validation error carrying a valid `price`
   module asserts `getQuote` returns a well-formed `MarketQuote`; a test with a
   `price`-less result asserts it throws `No price data available`.

4. [ ] Route `analyst-ratings.service.ts:50` through `safeQuoteSummary`; do **not**
   add a hard module guard here (missing `recommendationTrend` = no coverage =
   existing neutral path). Rely on the wrapper's null-`result` re-throw only.
   — Acceptance: unit test with a mocked validation error whose `error.result` has no
   `recommendationTrend` asserts `fetchAnalystRatings` returns `totalAnalysts: 0` and
   a neutral score (not a throw).

5. [ ] Add tests. Mock `@/lib/yahoo-finance` (per the existing `vi.mock` pattern in
   `news.service.test.ts`) and `@/lib/prisma`. Construct a fake error object with
   `name: "FailedYahooValidationError"`, a `result`, and an `errors` array to
   exercise the wrapper and each service without hitting live Yahoo. Cover: wrapper
   happy path / re-throw / null-result re-throw; each service's coerced-partial and
   guard paths.
   — Acceptance: `npm run verify` — all new tests pass under `vitest run`.

6. [ ] Add an ADR to `DECISIONS.md` (draft in this plan's "Proposed DECISIONS.md
   entry") and an AGENT.md fragile-surface entry documenting: the wrapper is the
   single sanctioned `quoteSummary` entry point; detection is by `error.name` not
   `instanceof` (and why deep-importing the error class is forbidden); the warn-log
   is the Yahoo-drift signal that should trigger a `yahoo-finance2` bump.
   — Acceptance: `DECISIONS.md` has the new ADR with evidence file:line; `AGENT.md`
   has the fragile-surface entry; both committed with the code.

[Task status markers — the Coding agent maintains these here as it works:]
[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `lib/yahoo-finance.ts` — add and export `safeQuoteSummary`.
- `lib/services/fundamental-analysis.service.ts` — call wrapper; add module guard.
- `lib/services/market-data.service.ts` — call wrapper; confirm existing guard.
- `lib/services/analyst-ratings.service.ts` — call wrapper; no new guard.
- `lib/yahoo-finance.test.ts` (new) — wrapper unit tests.
- `lib/services/fundamental-analysis.service.test.ts` (new) — service tests.
- `lib/services/analyst-ratings.service.test.ts` (new) — service tests.
- `lib/services/market-data.service.test.ts` (new) — service tests.
  (Test files may be consolidated if the Coding agent prefers, as long as each
  acceptance check is covered.)
- `DECISIONS.md` — new ADR.
- `AGENT.md` — new fragile-surface entry.
- `ARCHITECTURE.md` — one-line note on the shared `safeQuoteSummary` chokepoint in
  the `lib/yahoo-finance.ts` key-files row (optional but preferred).

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically:
typecheck + lint + tests + secret scan. Beyond it:

- **Manual smoke (owner/Coding agent):** with the dev server running, hit
  `GET /api/market/fundamentals/AAPL` (via the Fundamental tab on a research page)
  and confirm it returns 200 with populated metrics rather than the 500. If Yahoo is
  currently drifting, confirm a single `console.warn` drift line appears in the
  server log and the metrics still render.
- **No live-Yahoo dependency in tests:** the deterministic proof is the mocked
  validation-error tests (Tasks 2–5) — they must pass with no network. Do not add a
  test that calls live `quoteSummary`.

## Assumptions

- The owner wants fundamental/analyst/quote analysis to **degrade gracefully and
  keep working** through Yahoo payload drift, preferring a usable-but-possibly-partial
  result plus a log signal over a hard failure — consistent with the reported
  breakage being "it worked earlier and should again." (If instead the owner would
  rather hard-fail on any drift to guarantee only fully-validated numbers ever show,
  that inverts Tasks 1–4; nothing read suggests that preference, and AGENT.md's
  no-silent-wrong-number rule is satisfied by the fail-loud-on-empty guards.)
- `console.warn` is an acceptable drift signal; no external alerting/monitoring is
  wired in this project, so a greppable server-log warning is the available channel.
- Bumping the `yahoo-finance2` dependency to a version with an updated schema is a
  separate, later action (triggered by the drift warning) — not part of this fix,
  which must work with the currently-pinned `^3.13.0`.

## Open decisions (if any)

None — the remedy, its location, the detection mechanism, and the guard boundaries
are all resolvable from the installed library's verified behavior and AGENT.md's
no-silent-wrong-number rule. Proceed.

## Proposed DECISIONS.md entry

## ADR-15 — Resilient `quoteSummary` wrapper: catch Yahoo schema-validation drift, warn, use the coerced result
- **Decision:** all `yahoo-finance2` `quoteSummary` calls go through a shared
  `safeQuoteSummary(symbol, queryOptions)` in `lib/yahoo-finance.ts`. It keeps the
  library's Zod validation ON, catches the throw by `error.name ===
  "FailedYahooValidationError"` (not `instanceof` — the v3 package neither exposes an
  `errors` subpath in its `exports` map nor an `errors` property on the instance, and
  deep-importing the error class would violate the exports map / break bundling),
  logs a `console.warn` with the drifted field paths, and returns the library's
  already-coerced `error.result`. If `error.result` is nullish it re-throws; all
  non-validation errors re-throw unchanged. Call sites keep their own critical-module
  guards (`market-data`/`fundamentals` throw when the structurally-required module is
  absent; `analyst-ratings` does not, since a missing `recommendationTrend` is a valid
  "no coverage" state).
- **Evidence:** to be implemented — `lib/yahoo-finance.ts` (`safeQuoteSummary`),
  `lib/services/fundamental-analysis.service.ts` (call + `price`/`summaryDetail`
  guard), `lib/services/market-data.service.ts` (call + existing `!quote.price`
  guard), `lib/services/analyst-ratings.service.ts` (call, no added guard),
  `lib/yahoo-finance.test.ts` and the three service test files.
- **Tradeoffs:** the wrapper's return type is untyped (`Record<string, unknown>`),
  pushing shape-guarding to callers — accepted because the three extractors already
  treat the response as `Record<string, any>` with heavy null-guarding, so the
  burden already lived there. We keep validation on (vs. blanket `validateResult:
  false`) specifically to retain the drift signal; the cost is a `try/catch` on every
  call and a warn log on each drift, which is the intended observability. Rejected:
  (a) blanket `validateResult: false` — silences the signal AGENT.md's
  no-silent-wrong-number rule depends on; (b) per-call-site patching — leaves a
  fourth future call site free to regress.
- **Status:** proposed
- **Confidence:** High — the library's v3 error shape, the missing `errors` export,
  and the `error.name`/`error.result` fields were verified directly against the
  installed `yahoo-finance2@3.13.0`.
