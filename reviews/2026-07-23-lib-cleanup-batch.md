# Review: batched `lib/` cleanup — TD-09, TD-12, TD-11, TD-34
Date: 2026-07-23
Status:

## Summary
Findings: [0 BLOCKERs, 1 ISSUE, 2 SUGGESTIONs, 0 QUESTIONs]
Requires owner decision: none
Ready for Coding agent: LCB-I1, LCB-S1, LCB-S2

Reviewed branch HEAD `6c1258db` on `feature/lib-cleanup-batch-td09-td11-td12-td34`
against `main` (`766aebef`), implementing `plans/2026-07-23-lib-cleanup-batch.md`.
Working tree clean at review time (`git status --porcelain` empty — the
orchestrator's STATUS.md edit was already committed at `6c1258db`, so the
in-flight carve-out did not need to apply). Branch is in sync with its upstream.

All four debt items land as planned, all seven plan tasks are marked `[x]`, and
`npm run verify` passes end to end: typecheck clean, lint clean of new warnings
(pre-existing `no-console`/`no-explicit-any` only), **269/269 tests across 34
files**, gitleaks `no leaks found`.

The four areas flagged for scrutiny all hold up:

1. **TD-12 behavior preservation — verified, both policies survive.**
   `createGeminiClient` throws `'GEMINI_API_KEY is not configured'` (byte-identical
   message) *inside the constructor call*, so `sentiment.service.ts:19`'s
   `this.genAI = createGeminiClient()` still throws at construction, and the
   module-scope singleton at `sentiment.service.ts:188` still makes that an
   import-time throw — the AGENT.md fragile-surface contract is intact. The
   insights route's AUD-10 branch is genuinely untouched: `getGeminiApiKey()` at
   `:56`, the `if (!geminiKey)` early-return placeholder at `:64` unchanged, and
   `createGeminiClient(geminiKey)` only reached at `:76` inside the try, after the
   key is proven non-empty. Critically, **the plan's acceptance gate actually held
   rather than being quietly relaxed**: `git diff main...HEAD --
   app/api/insights/portfolio/route.test.ts` is **empty** (the file is unmodified),
   and `sentiment.service.test.ts`'s diff is purely additive (one `afterEach`
   import plus a new `describe` block asserting the constructor throw) — no
   existing assertion was edited. `grep -rn "new GoogleGenerativeAI"` across
   `app lib components hooks scripts` returns exactly one code hit,
   `lib/services/gemini.ts:38`.

2. **TD-11 cache-gate correctness — verified, including the legacy-row path.**
   `scoreDetailsWithVersion` (`:566`) is written in **both** `saveToDatabase`
   branches — update at `:601` and create at `:633` — so no write path can persist
   an unversioned row. The two gates are genuinely independent and ANDed:
   `isCacheFresh` (`:111`) reads only `scoringVersion`, `isWithin24Hours` (`:112`)
   reads only `lastUpdated`, and `:116` requires `cached && isCacheFresh &&
   isWithin24Hours`. I probed the read expression against every shape a nullable
   Prisma `Json?` column can return (SQL NULL, JSON null, missing key,
   `scoringVersion: null`, array, bare number, bare string, v1, v2, v3): all
   malformed and legacy shapes evaluate to `false` — treated as stale and
   refetched — and **none throws**, because `?.` short-circuits and `?? 0` floors
   the comparison. A legacy row is correctly stale, never read as equal. See
   LCB-S2 for one benign operator nuance.

3. **TD-34(a) and ADR-15 — correctly scoped, no escalation.**
   `lib/yahoo-finance.ts:33` passes `validation: { logErrors: false }` alongside
   the existing `suppressNotices`, and nothing else. `validateResult` appears
   nowhere in the repo — the implementation did not escalate. Validation stays on,
   so `FailedYahooValidationError` still throws and `safeQuoteSummary`'s
   catch/coerce/one-line-warn contract is untouched; the four pre-existing
   `yahoo-finance.test.ts` cases that encode that contract pass **unmodified**,
   with only an additive constructor-capture case appended. TD-34(b) is clean too:
   `earningsHistory` no longer appears anywhere in `app lib components hooks
   scripts` except one explanatory comment.

4. **ADR-27 evidence — placeholder replaced with real citations.** The plan's
   `[Coding agent to fill: ...]` placeholder is gone; ADR-27 now carries concrete
   file:line evidence plus a covering-tests list. I resolved every citation
   against the committed code — all land exactly on the claimed construct
   (`fundamental-analysis.service.ts:84` → `export const SCORING_VERSION = 2`,
   `gemini.ts:25`/`:34` → the two exports, `sentiment.service.ts:19` → the factory
   call, `yahoo-finance.ts:33` → the validation option, `:601`/`:633` → both
   `saveToDatabase` branches) **except two**, filed as LCB-I1.

5. **Deletion safety (TD-09) — confirmed.** `grep` for `lib/env`, `lib/utils/env`,
   `utils/env`, and relative `./env`/`../env` across `app lib components hooks
   scripts prisma` with `*.ts`/`*.tsx`/`*.js`/`*.json` returns **zero hits**, as
   does a targeted scan of dynamic `import(` expressions for `env`. Nothing
   referenced either module by static import, dynamic import, or string path, so
   typecheck's silence is corroborated rather than assumed. Per the task brief,
   the resulting centralized-validation gap is not re-flagged: TD-37 is present in
   the Backlog with the specified wording, severity Low, effort Medium.

**Security pass (Step 1).** The `security-review` skill was run; its diff-based
analysis surfaced **no HIGH or MEDIUM findings**, which matches my own manual
pass over the changed non-test code. Specifics: `getGeminiApiKey`/
`createGeminiClient` read a trusted env var and pass it straight to the SDK — the
key is never logged and the thrown message carries no secret material; the
insights route's `getAuthenticatedUser()` guard and AUD-10 branch are untouched,
so no authz boundary moved; `logErrors: false` only reduces console verbosity and
disables no control; the deleted env modules had zero importers, so removing them
removes no enforced runtime validation; and `scoreDetails` is service-written JSON
read via typed property access with a numeric fallback — no injection or unsafe
deserialization sink. Gitleaks passes on the tree.

**Doc drift.** None found. AGENT.md's four fragile-surface entries were rewritten
accurately (the stale `:78`/`:97` citations the plan called out are fixed — the
new `:84` citation resolves exactly), ARCHITECTURE.md gains the `lib/services/gemini.ts`
key-file row and the `yahoo-finance.ts` flag note, TECH_DEBT.md moves all four
items to Resolved with correct 4-column rows, ADR-15 gains a non-superseding
evidence note, and `plans/INDEX.md` is `in review` (correct — `implemented` is
gated on this review being stamped). A stale duplicate TD-02 INDEX row was also
dropped. STATUS.md is 12 lines, links-only, no narrative, no custom sections.

**Test coverage.** Every function added or modified in this batch has both a
happy-path and a meaningful failure-case test: `createGeminiClient` (explicit key,
env-default key, unset-key throw, empty-string throw), `getGeminiApiKey`
(set/unset), the `SCORING_VERSION` gate (fresh hit, missing version, lower
version, and a 24h-independence regression case), the sentiment constructor
throw, and the yahoo client constructor options. No coverage gap to flag.

## Findings

### LCB-I1 — ISSUE
**File:** `DECISIONS.md` (ADR-27 `**Evidence:**` line) → cites `app/api/insights/portfolio/route.ts:57,77`
**Problem:** Two of ADR-27's evidence citations are off by one line. The ADR cites
`app/api/insights/portfolio/route.ts:57,77` for `getGeminiApiKey()` and
`createGeminiClient(geminiKey)`, but the actual lines in the committed file are
**56** and **76** (line 57 is blank; line 77 is the `// AUD-07:` comment). Every
other citation in the same Evidence line resolves correctly, so this is an
isolated slip rather than a systematically stale block — but CLAUDE.md's hard
limits require ADR evidence to cite real locations, and a citation that lands on a
blank line is exactly the drift that erodes trust in the ADR log. This was the
specific risk the plan flagged when it left the placeholder for the Coding agent
to fill.
**Recommendation:** In `DECISIONS.md`, edit ADR-27's `**Evidence:**` line to
replace `app/api/insights/portfolio/route.ts:57,77` with
`app/api/insights/portfolio/route.ts:56,76`. No code change.

### LCB-S1 — SUGGESTION
**File:** `lib/services/fundamental-analysis.service.ts:110`
**Problem:** The cast `cached?.scoreDetails as { scoringVersion?: number } | null |
undefined` asserts a shape that a nullable Prisma `Json?` column does not
guarantee — the same column can legitimately hold an array, a bare number, or a
string. The runtime code is **safe** as written (I verified every such shape
evaluates to "stale" via `?.` + `?? 0`, and none throws), so this is not a defect;
it is only that the type assertion is broader than what the value is proven to be,
and a future edit that reads a second field off `cachedScoreDetails` without the
optional chain would compile while being unsound.
**Recommendation:** Optional hardening — narrow before casting, e.g.
`const cachedScoreDetails = cached?.scoreDetails && typeof cached.scoreDetails === 'object' && !Array.isArray(cached.scoreDetails) ? (cached.scoreDetails as { scoringVersion?: number }) : null;`
leaving the `isCacheFresh` expression unchanged. Behavior is identical today; this
only makes the guarantee structural rather than incidental. Defer freely if the
Coding agent judges the added branch not worth it.

### LCB-S2 — SUGGESTION
**File:** `DECISIONS.md` (ADR-27 Decision text, clause 1) vs `lib/services/fundamental-analysis.service.ts:111`
**Problem:** ADR-27's decision text states a cached row is fresh only when its
`scoreDetails.scoringVersion` **equals** the current `SCORING_VERSION`, but the
implementation uses `>=` (`(cachedScoreDetails?.scoringVersion ?? 0) >= SCORING_VERSION`).
The two differ only for a row written by a *newer* `SCORING_VERSION` than the
running code — under `>=` an older deployment treats such a row as fresh, under
`===` it would refetch and overwrite it with a downgraded score. `>=` is arguably
the better behavior (a rollback does not stampede the cache or clobber
newer-format rows), so the code is not wrong; the doc is simply more specific than
the code. AGENT.md's fragile-surface entry carries the same `===` phrasing.
**Recommendation:** Align the prose to the code rather than the code to the prose
— in ADR-27's Decision clause (1) and AGENT.md's `fundamental-analysis.service.ts:84`
entry, change "equals the current `SCORING_VERSION`" to "is greater than or equal
to the current `SCORING_VERSION` (`>=`, so a row written by a newer deployment is
not clobbered on rollback)". No code change.

## Proposed DECISIONS.md entries

None. ADR-27 as committed already covers both invariants in this batch (plus the
TD-12 factory and TD-09 deletion), correctly leaves ADR-15 in force with a
non-superseding evidence note, and needs only the LCB-I1 line-number correction
and the LCB-S2 wording alignment — neither of which is a new decision.
