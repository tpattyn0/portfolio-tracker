# Plan: batched `lib/` cleanup — TD-09, TD-12, TD-11, TD-34
Date: 2026-07-23

## Problem

Four Low-severity, Low-effort `TECH_DEBT.md` items are all confined to `lib/`
service/config code. Each is individually too small to justify its own
branch/PR/review cycle, and two of them (TD-11, TD-34b) touch the same file and
interact. Batching them into one plan, one branch, one PR, one review is cheaper
and safer than four sequential passes.

All four were re-verified against HEAD `766aebef` during planning:

| Item | Claim | Verified |
|---|---|---|
| TD-09 | `lib/env.ts` + `lib/utils/env.ts` are dead code validating `GOOGLE_API_KEY` instead of `GEMINI_API_KEY` | Confirmed. `grep` for any import of `@/lib/env`, `@/lib/utils/env`, or a relative `./env`/`../env` across `app/`, `lib/`, `components/`, `hooks/`, `scripts/` returns **zero hits**. `lib/utils/logger.ts:10` defines its own local `isDevelopment` from `process.env.NODE_ENV` — it does **not** import `lib/utils/env.ts`'s exported `isDevelopment`. Both modules run `z.parse` at module scope, so importing either today would throw on a machine without `NEXTAUTH_URL` set. |
| TD-12 | Two independent `new GoogleGenerativeAI(...)` instantiations | Confirmed at `lib/services/sentiment.service.ts:22` and `app/api/insights/portfolio/route.ts:77`. `GEMINI_MODEL` (`lib/services/gemini.ts:10`) is already shared; only the client construction is duplicated. |
| TD-11 | Hardcoded `latestMigrationDate` date literal gates cache freshness | Confirmed at `lib/services/fundamental-analysis.service.ts:91`, consumed at `:92` (`isCacheFresh`), combined with `isWithin24Hours` at `:97`. |
| TD-34 | `earningsHistory` is fetched but never consumed | Confirmed. `grep -rn "earningsHistory\|epsActual\|surprisePercent"` across the repo (excluding `node_modules`) returns exactly **one** hit: `fundamental-analysis.service.ts:110`, the modules array itself. `extractMetrics` reads only `price`, `summaryDetail`, `defaultKeyStatistics`, `financialData`, `earningsTrend`. |

Note: TD-34's `TECH_DEBT.md` entry and the `AGENT.md` fragile-surface entry for
TD-11 both cite **stale line numbers** (`:97` and `:78` respectively). The real
lines are `:110` and `:91`. Fix the citations as part of the doc updates below.

## Approach

Four independent changes, sequenced so the two that touch
`fundamental-analysis.service.ts` land in a deliberate order. Each is behavior-
preserving except where explicitly stated.

### TD-09 — delete both dead env modules (chosen over consolidation)

**Decision: delete `lib/env.ts` and `lib/utils/env.ts`. Do not build a
replacement in this pass.**

Rationale — consolidation is the worse option *here specifically*:

- To be worth anything, a consolidated schema must actually be imported. The
  only import point that would give real coverage is a module every server path
  transits — and this app has no such single entry point (Next.js App Router has
  no server bootstrap file; `middleware.ts` runs on the Edge runtime, where a
  `process.env`-parsing Zod module is the wrong shape). Wiring it into
  individual services would mean editing ~5 files to add validation that each
  service already does inline for the one variable it cares about
  (`sentiment.service.ts:19-21` throws on missing `GEMINI_API_KEY`;
  `insights/portfolio/route.ts:65` returns a graceful placeholder;
  `news.service.ts:354` feature-gates on it). That is a genuinely larger change
  than "Low effort," and it would need a design decision about
  fail-loud-vs-degrade that the existing call sites already answer differently
  and deliberately.
- Both modules `.parse()` at module scope and require `NEXTAUTH_URL` — importing
  either as-is would harden a currently-soft failure into an import-time crash,
  including in `vitest` and in `next build`'s static analysis. That is a
  behavior change disguised as cleanup.
- Deleting is the honest option: it makes the current de facto behavior (raw
  `process.env` reads with per-call-site guards) visible instead of leaving two
  files that *look* like validation exists.

The gap this leaves — no centralized env validation — is real but pre-existing
and not made worse by deletion. Log it as a **new `TECH_DEBT.md` entry (TD-37)**
so it is tracked rather than silently dropped, and remove TD-09 from the Backlog
into Resolved.

**No tests are written for this task — it is a pure deletion of two modules with
zero importers.** There is no function added or modified, so the
"happy-path + failure-case" rule has no subject. The acceptance check is a grep
proving zero importers plus a green `npm run verify`.

### TD-12 — one shared Gemini client factory, behavior-preserving

The two call sites configure the client identically (`new
GoogleGenerativeAI(key)` — no second argument at either site, verified) but
differ **materially in their missing-key behavior**, and that difference must
survive consolidation:

| Site | Missing-key behavior today | Why |
|---|---|---|
| `sentiment.service.ts:19-22` | **Throws** `'GEMINI_API_KEY is not configured'` — in the constructor, and a singleton is instantiated at module scope (`sentiment.service.ts:191`), so it throws at **import** time | Documented in `AGENT.md` fragile surfaces; `sentiment.service.test.ts:12-14` sets the key before import specifically because of this |
| `insights/portfolio/route.ts:57,65-74` | **Returns a 200 with a graceful placeholder body**, never constructs a client — and deliberately does **not** persist that placeholder (AUD-10) | `app/api/insights/portfolio/route.test.ts` covers this |

Therefore the shared helper must **not** impose one policy on both. Add to
`lib/services/gemini.ts` (the existing shared Gemini config module) two exports:

- `getGeminiApiKey(): string | undefined` — a single read of
  `process.env.GEMINI_API_KEY`.
- `createGeminiClient(apiKey?: string): GoogleGenerativeAI` — takes an explicit
  key (defaulting to `getGeminiApiKey()`), throws
  `'GEMINI_API_KEY is not configured'` when it is absent, and returns
  `new GoogleGenerativeAI(key)`.

Then:
- `sentiment.service.ts`'s constructor becomes `this.genAI = createGeminiClient();`
  — the throw moves into the factory but the message, the throw-at-construction
  timing, and therefore the throw-at-import singleton behavior are all unchanged.
- `insights/portfolio/route.ts` keeps its own `const geminiKey =
  getGeminiApiKey()` + early-return placeholder branch exactly as-is (that
  branch is the AUD-10 fix and is not TD-12's scope), and its
  `new GoogleGenerativeAI(geminiKey)` at `:77` becomes
  `createGeminiClient(geminiKey)`. Inside that `try`, `geminiKey` is already
  proven non-empty by the guard above, so the factory's throw is unreachable
  there — and even if it were reached, it lands in the existing
  `catch (aiError)` which returns the same non-persisted fallback. No behavior
  change either way.

Net effect: `new GoogleGenerativeAI(...)` appears in exactly one place. Neither
call site's observable behavior changes.

**Note for the Coding agent:** `app/api/insights/portfolio/route.test.ts:100`
and `lib/services/sentiment.service.test.ts:22` both `vi.mock` the
`@google/generative-ai` module (not the call site), so both mocks continue to
intercept the constructor through the new factory without modification. Confirm
this rather than assume it — if either test mocks a path the factory bypasses,
fix the test in this same task.

### TD-11 — `SCORING_VERSION` constant replaces the date literal (do this AFTER TD-34b)

Replace the `latestMigrationDate` date comparison with an explicit version
constant. Concretely, in `lib/services/fundamental-analysis.service.ts`:

- Add an exported `SCORING_VERSION` constant (a small integer, starting at `2`)
  with a comment stating the rule: **bump this whenever extraction or scoring
  logic changes in a way that makes previously-cached rows wrong.**
- `FundamentalData` has **no version column** (verified against
  `prisma/schema.prisma:119-165`) and **this plan adds no migration** — dev and
  prod share one database (ADR-6) and migrations are owner-gated (ADR-14/ADR-19
  protocol). Instead, persist the version **inside the existing `scoreDetails`
  JSON column**, which `saveToDatabase` already writes
  (`fundamental-analysis.service.ts:575`, `:607`) and `formatCachedData` already
  reads (`:616`). Write `scoringVersion: SCORING_VERSION` alongside the score
  object; treat a cached row whose `scoreDetails.scoringVersion` is absent or
  `< SCORING_VERSION` as stale.
- `isCacheFresh` becomes a version check instead of a date check. `isWithin24Hours`
  is **unchanged** — the two gates remain independent and are still ANDed at
  `:97`.

**Behavior change, intentional and to be called out in the PR body:** starting
at `SCORING_VERSION = 2`, every existing cached `FundamentalData` row lacks
`scoringVersion` and is therefore treated as stale on first read, triggering one
fresh Yahoo fetch per symbol. This is exactly the same effect the old date
literal would have had if bumped, it is self-healing (the refetched row is
written with the version), and it is desirable here — see the sequencing note
below. Confirm in the PR body that this one-time refetch is expected, not a
regression.

**`scoreDetails` shape compatibility:** `formatCachedData` at `:616` reads
`cached.scoreDetails` and the weights test
(`fundamental-analysis.service.weights.test.ts:120,135`) asserts on its `total`
and `breakdown`. Adding a `scoringVersion` key is additive; do not restructure
or rename the existing keys. Verify the weights test still passes untouched — if
it needs editing, that is a signal the shape changed more than intended.

### TD-34 — both options, (b) before (a)

**(b) Drop `'earningsHistory'` from the modules array** at
`fundamental-analysis.service.ts:110`. Confirmed unconsumed (single grep hit, in
the array itself). This removes the specific drifting module at the source:
Yahoo is not asked for it, the library never validates it, the payload shrinks.
Leave the other eight modules alone — `cashflowStatementHistory`,
`upgradeDowngradeHistory`, and `recommendationTrend` are also not read by
`extractMetrics`, but auditing those is **out of scope** for this plan; note the
observation in the summary rather than expanding the change.

**(a) Pass `validation: { logErrors: false }`** to the shared
`new YahooFinance(...)` in `lib/yahoo-finance.ts:12-14`, alongside the existing
`suppressNotices`.

Compatibility with ADR-15 — **verified directly against the installed
`yahoo-finance2@3.13.0` source, not assumed**:

- `node_modules/yahoo-finance2/esm/src/lib/validateAndCoerceTypes.js`: the
  `logger.error("The following result did not validate with schema: ...")` dump
  sits inside an `if (options.logErrors === true)` block at `:183`; the
  `throw new FailedYahooValidationError(...)` at `:214` is **outside** that
  block. So `logErrors: false` suppresses only the console dump. Validation
  still runs, the error is still thrown with its `result`/`errors` payload,
  `safeQuoteSummary` still catches it by `error.name` and still emits its own
  one-line `console.warn` drift signal.
- `esm/src/lib/options/defaults.js:18-20` sets the runtime default
  `validation: { logErrors: true, logOptionsErrors: true, allowAdditionalProps: true }`.
  `esm/src/lib/options/options.js`'s `mergeObjects` recurses into nested objects,
  so passing `validation: { logErrors: false }` overrides that one key and
  leaves `allowAdditionalProps: true` intact — it does **not** replace the whole
  `validation` object. (`allowAdditionalProps: true` matters: `false` would make
  validation stricter and produce *more* drift errors.)
- This is therefore **not** the blanket `validateResult: false` that ADR-15
  explicitly rejected (rejected alternative (a) in ADR-15's Tradeoffs, on the
  grounds that it silences the drift signal). Validation stays on and the
  designed signal is retained. ADR-15 needs no amendment, only an evidence note.

**Sequencing (b) before (a), and its interaction with TD-11:** dropping a module
changes what is fetched, which is exactly what a cache version exists to
invalidate. Doing (b) first, then TD-11, means the `SCORING_VERSION = 2` bump
introduced by TD-11 is the mechanism that invalidates rows cached from the
old nine-module payload. **Yes — `SCORING_VERSION` should be bumped as part of
this change, and starting it at `2` (not `1`) is that bump**: rows written
before this PR carry no `scoringVersion` and are correctly treated as stale.
Concretely: since `earningsHistory` fed no extracted metric, no cached *number*
is actually wrong — but making the version constant do its job on its very first
outing is the right way to prove the mechanism works, and costs one refetch per
symbol.

Also update `AGENT.md`'s `lib/yahoo-finance.ts` fragile-surface entry to mention
the flag (TD-34's entry asks for this explicitly) — specifically, that
`logErrors: false` is deliberate, suppresses only the pre-throw dump, and must
**not** be "upgraded" to `validateResult: false`, which would silence the drift
signal ADR-15 depends on.

## Tasks

1. [x] **TD-09 — delete the two dead env modules.** Delete `lib/env.ts` and
   `lib/utils/env.ts`. No replacement module. — Acceptance:
   `grep -rn "lib/env\|lib/utils/env\|from ['\"]\.\./env['\"]\|from ['\"]\./env['\"]" --include="*.ts" --include="*.tsx" app lib components hooks scripts`
   returns zero hits; `npm run verify` green (typecheck proves nothing referenced
   them). No new tests — deletion only, no function added or modified.

2. [x] **TD-12 — add `getGeminiApiKey` + `createGeminiClient` to
   `lib/services/gemini.ts`.** Factory throws
   `'GEMINI_API_KEY is not configured'` (exact existing message) when the key is
   absent. — Acceptance: new `lib/services/gemini.test.ts` passes with (happy)
   returns a `GoogleGenerativeAI` instance when a key is present, and (failure)
   throws with the exact message when `GEMINI_API_KEY` is unset. Mock
   `@google/generative-ai`; save/restore `process.env.GEMINI_API_KEY` around each
   case.

3. [x] **TD-12 — rewire both call sites to the factory.**
   `sentiment.service.ts:18-23` constructor → `createGeminiClient()`;
   `insights/portfolio/route.ts:57` → `getGeminiApiKey()`, `:77` →
   `createGeminiClient(geminiKey)`. Leave the route's placeholder early-return
   branch (`:65-74`) untouched. — Acceptance: `lib/services/sentiment.service.test.ts`
   and `app/api/insights/portfolio/route.test.ts` pass **unmodified**; if either
   needs a change, the consolidation altered observable behavior — stop and
   re-check against the table in Approach. Add one test asserting
   `sentiment.service.ts` still throws at construction when the key is unset
   (the `AGENT.md` fragile-surface contract), if not already covered.
   `grep -rn "new GoogleGenerativeAI" --include="*.ts" app lib` returns exactly
   one hit, in `lib/services/gemini.ts`.

4. [x] **TD-34(b) — drop `'earningsHistory'` from the modules array**
   (`fundamental-analysis.service.ts:110`). Do not touch the other eight
   modules. — Acceptance: `grep -rn "earningsHistory" --include="*.ts" app lib`
   returns zero hits; `npm run verify` green;
   `lib/services/fundamental-analysis.service.test.ts` passes unmodified (it
   does not assert on the modules array — verified).

5. [x] **TD-11 — replace `latestMigrationDate` with `SCORING_VERSION`.** Add
   the exported constant (starting at `2`) with the bump-rule comment; write
   `scoringVersion` into the `scoreDetails` JSON in both the `update` and
   `create` branches of `saveToDatabase` (`:575`, `:607`); replace `isCacheFresh`
   at `:92` with a version check reading
   `cached.scoreDetails?.scoringVersion`; leave `isWithin24Hours` and the AND at
   `:97` unchanged. — Acceptance: new tests in
   `lib/services/fundamental-analysis.service.test.ts` (or a sibling file)
   covering: (happy) a cached row with `scoringVersion === SCORING_VERSION` and
   `lastUpdated` within 24h is served from cache with no `safeQuoteSummary`
   call; (failure/staleness) a cached row with a **missing** `scoringVersion`,
   and one with a **lower** `scoringVersion`, each trigger a fresh fetch even
   when `lastUpdated` is within 24h; and (regression) a row with the current
   version but `lastUpdated` older than 24h still refetches — proving the two
   gates stayed independent.
   `lib/services/fundamental-analysis.service.weights.test.ts` must pass
   **unmodified** (its cached-row fixture at `:91` is `lastUpdated: new Date()`;
   if the version gate now makes that fixture stale the test will fail — that is
   a real signal the fixture needs a `scoringVersion`, which **is** an
   acceptable edit; what is not acceptable is changing its `total`/`breakdown`
   assertions).

6. [x] **TD-34(a) — pass `validation: { logErrors: false }`** to
   `new YahooFinance(...)` in `lib/yahoo-finance.ts:12-14`, with a comment
   citing ADR-15 and the "not `validateResult: false`" boundary. — Acceptance:
   `lib/yahoo-finance.test.ts`'s four existing cases pass **unmodified** (they
   assert the catch/coerce/warn contract, which is what must survive); add one
   case asserting the shared client is constructed with
   `validation: { logErrors: false }` — the existing `vi.mock("yahoo-finance2")`
   at `:15-19` uses a bare `class { quoteSummary = ... }` that ignores its
   constructor args, so capture the constructor argument in the mock to assert
   on it.

7. [x] **Docs.** — Acceptance: all of the following are true.
   - `TECH_DEBT.md`: TD-09, TD-11, TD-12, TD-34 moved from Backlog to Resolved
     with today's date and this plan as "resolved by". New **TD-37** added to
     Backlog: "No centralized environment-variable validation — the two dead
     modules that purported to provide it were deleted 2026-07-23 (TD-09);
     current behavior is raw `process.env` reads with per-call-site guards.
     Severity Low, Effort Medium (needs a fail-loud-vs-degrade decision per
     variable and a real import point)."
   - `AGENT.md`: delete the now-false `lib/env.ts`/`lib/utils/env.ts`
     fragile-surface entry (line 14) — the files no longer exist. Update the
     `fundamental-analysis.service.ts:78` entry (line 17) to describe
     `SCORING_VERSION` and its bump rule, and fix the stale line number. Update
     the two-Gemini-clients entry (line 18) to state that both sites now share
     `createGeminiClient` and that `new GoogleGenerativeAI` must not reappear
     outside `lib/services/gemini.ts`. Update the `lib/yahoo-finance.ts` entry
     (line 44) to mention `validation: { logErrors: false }` and the
     do-not-escalate-to-`validateResult:false` boundary.
   - `ARCHITECTURE.md`: update the `lib/yahoo-finance.ts` Key-files row to
     mention the flag; add `lib/services/gemini.ts` to the Key files table (it
     is now a factory, not just a constant).
   - `DECISIONS.md`: add **ADR-27** (below). ADR-15 is **not** superseded —
     append a one-line evidence note to it pointing at ADR-27 for the log-flag
     detail.
   - `plans/INDEX.md`: this plan's row.

## Files to create or modify

**Delete**
- `lib/env.ts`
- `lib/utils/env.ts`

**Modify**
- `lib/services/gemini.ts` — add `getGeminiApiKey`, `createGeminiClient`
- `lib/services/sentiment.service.ts` — constructor uses the factory
- `app/api/insights/portfolio/route.ts` — key read + client construction via the factory
- `lib/services/fundamental-analysis.service.ts` — `SCORING_VERSION`, `scoreDetails.scoringVersion` write + read, modules array minus `earningsHistory`
- `lib/yahoo-finance.ts` — `validation: { logErrors: false }`
- `lib/yahoo-finance.test.ts` — add the constructor-options case
- `lib/services/fundamental-analysis.service.test.ts` — add the version-gate cases
- `lib/services/fundamental-analysis.service.weights.test.ts` — fixture may need `scoringVersion` (assertions must not change)
- `TECH_DEBT.md`, `AGENT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `plans/INDEX.md`

**Create**
- `lib/services/gemini.test.ts`

## Verification

`npm run verify` (the `## Verify` block in `AGENT.md`) covers typecheck, lint,
tests, and the secret scan. Beyond it:

- **Manual, TD-34:** run the app and hit a fundamentals-heavy research page for
  a symbol known to drift (the 2026-07-18 observation was on the fundamentals
  path). Expected console output: the single
  `[yahoo-finance] Schema validation drift for <SYMBOL> ...` line from
  `safeQuoteSummary`, and **none** of the ~40-line
  `The following result did not validate with schema` block. If no drift occurs
  naturally, this is unobservable — say so in the PR body rather than claiming
  it was verified.
- **Manual, TD-11:** load a research detail page for a symbol with an existing
  `FundamentalData` row. Expected: one fresh Yahoo fetch on the first load after
  deploy (the version-bump invalidation), then cache hits on subsequent loads
  within 24h. Fundamental scores must be unchanged between the pre- and
  post-refetch values for a stable symbol — `earningsHistory` fed no metric, so
  a changed score is a regression, not an expected effect.
- **Manual, TD-12:** confirm the daily portfolio insight still generates
  (`/dashboard`) and news sentiment still scores on a research page — these are
  the two Gemini paths and the consolidation is meant to be invisible to both.

## Assumptions

- Storing `scoringVersion` inside the existing `scoreDetails` JSON column is
  preferred over adding a `FundamentalData` schema column. Rationale: dev and
  prod share one database (ADR-6) and every migration in this repo is
  owner-gated with an explicit `prisma migrate deploy` sign-off
  (ADR-14/ADR-19) — a Low-effort cleanup batch should not carry a migration.
  If the owner would rather have a real column, that is a one-line plan change
  plus a `--create-only` migration held for sign-off.
- Starting `SCORING_VERSION` at `2` (rather than `1`) so that every currently
  cached row is invalidated exactly once on first read after merge is desirable,
  not a cost to avoid. The cost is one Yahoo fetch per previously-cached symbol,
  spread across normal usage.
- Deleting both env modules with no replacement is the right call for TD-09.
  The centralized-validation gap is tracked as new TD-37 rather than built here.
- The other eight `quoteSummary` modules in `fundamental-analysis.service.ts`
  are left alone even though `cashflowStatementHistory`,
  `upgradeDowngradeHistory`, and `recommendationTrend` also appear unread by
  `extractMetrics`. Auditing them is a separate, larger task — TD-34's entry
  scopes only `earningsHistory`.
- No UI or user-visible change in this batch, so no Designer input and no
  `DESIGN.md` read is required.

## Open decisions

None.

## Proposed DECISIONS.md entry

```
## ADR-27 — Fundamental cache freshness is gated by an explicit `SCORING_VERSION` carried in `scoreDetails`, not a date literal; yahoo-finance2's pre-throw validation dump is silenced without disabling validation
- **Decision:** two related `lib/` invariants, landed together in `plans/2026-07-23-lib-cleanup-batch.md`.
  (1) `lib/services/fundamental-analysis.service.ts` replaces the hardcoded `latestMigrationDate = new Date('2025-10-14')` cache-freshness gate with an exported `SCORING_VERSION` integer constant, persisted per-row inside the **existing** `scoreDetails` JSON column (no schema migration — dev and prod share one database, ADR-6, and migrations are owner-gated per ADR-14/ADR-19). A cached row is fresh only when its `scoreDetails.scoringVersion` equals the current `SCORING_VERSION` **and** `lastUpdated` is within 24h; the two gates stay independent. Any future change to extraction or scoring logic bumps the constant instead of editing a date.
  (2) `lib/yahoo-finance.ts`'s shared client is constructed with `validation: { logErrors: false }`. This suppresses **only** yahoo-finance2's ~40-line pre-throw console dump; validation itself stays ON and `FailedYahooValidationError` is still thrown, so `safeQuoteSummary`'s catch/coerce/one-line-`console.warn` contract (ADR-15) is fully retained. This is explicitly **not** the blanket `validateResult: false` that ADR-15 rejected. Separately, the never-consumed `'earningsHistory'` module is dropped from the fundamentals `quoteSummary` modules array, removing the specific drift source observed 2026-07-18.
- **Evidence:** [Coding agent to fill: file:line for `SCORING_VERSION`, the `scoreDetails.scoringVersion` write in `saveToDatabase`'s update+create branches, the version gate, `lib/yahoo-finance.ts`'s `validation` option, the modules array, and the covering tests in `lib/services/fundamental-analysis.service.test.ts` + `lib/yahoo-finance.test.ts`.]
- **Tradeoffs:** (1) Storing the version in JSON rather than a dedicated indexed column means the freshness check cannot be pushed into the SQL `where` clause — the row is fetched then evaluated in JS. Acceptable: the lookup is already a single `findUnique` by unique `symbol`, so nothing extra is read. Bumping `SCORING_VERSION` to `2` invalidates every existing cached row once (they carry no `scoringVersion`), costing one Yahoo fetch per symbol — deliberate, self-healing, and the correct behavior given the modules array also changed in the same PR. Rejected: a `FundamentalData.scoringVersion` column — correct long-term but requires an owner-gated migration, disproportionate to a Low-effort cleanup. (2) `logErrors: false` means a future contributor reading the raw library output loses the detailed per-field Zod error list on drift; `safeQuoteSummary`'s warn still names the symbol, the modules, and the drifted field paths, which is the actionable subset. The nested-option merge was verified against `yahoo-finance2@3.13.0`'s `mergeObjects` — passing `validation: { logErrors: false }` overrides that key only and preserves the default `allowAdditionalProps: true`; replacing the whole `validation` object would make validation *stricter* and is the failure mode to avoid.
- **Status:** accepted
- **Confidence:** High — the log-suppression boundary was verified directly in the installed library source (`node_modules/yahoo-finance2/esm/src/lib/validateAndCoerceTypes.js`: the dump is inside `if (options.logErrors === true)` at :183, the `throw new FailedYahooValidationError` at :214 is outside it), as was the nested-merge behavior (`esm/src/lib/options/options.js` `mergeObjects`) and the runtime default `validation.logErrors: true` (`esm/src/lib/options/defaults.js:18`). `earningsHistory`'s zero consumption was grep-verified repo-wide (single hit: the modules array itself).
```
