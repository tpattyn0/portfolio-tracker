# Review: Yahoo quoteSummary schema-validation resilience
Date: 2026-07-18
Status: IMPLEMENTED — 2026-07-18

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 0 QUESTIONs
Requires owner decision: none
Ready for Coding agent: YV-S1 (optional, no action required to merge)

Reviewed the implementation of `plans/2026-07-18-yahoo-validation-error.md` on branch
`fix/yahoo-validation-error` (PR #16) against branch HEAD (working tree clean at review
time). This is a clean, well-scoped, well-tested fix that faithfully implements the
approved plan.

> Process note: the `reviewer` role subagent was spawned twice for this review and both
> times returned only the `security-review` skill's output without completing the
> correctness/doc-drift/test-coverage/standing-checklist steps or writing this file. The
> orchestrator therefore performed steps 2–5 directly against the actual diff and wrote
> this file. The security conclusion (step 1) from those runs is folded into the Security
> section below. Logged as workflow feedback.

## Findings

### Security pass (step 1)
No vulnerabilities at or above the reporting threshold. `symbol` flows only into
`yahooFinance.quoteSummary()` (fixed host/protocol, library-controlled) and a
`console.warn` template — it reaches no SQL/shell/filesystem/template/eval sink. Prisma
`upsert`/`findUnique` are parameterized. The `console.warn` drift line carries only the
symbol, requested module names, and Zod field paths — no secrets, tokens, or PII.
`error.result` is the library's own coerced object, not untrusted deserialization. No
auth/crypto/endpoint surface touched.

### Correctness pass (step 2) — PASS
Verified against the code, not the subagent summaries:

- **`safeQuoteSummary` fail-loud contract** (`lib/yahoo-finance.ts:43-74`): catches only
  `error instanceof Error && error.name === "FailedYahooValidationError"`; returns
  `error.result` **only when truthy**; re-throws when `result` is nullish
  (`:72`); re-throws all non-validation errors unchanged. Matches the plan exactly. The
  `console.warn` fires only on the coerced-fallback path, so a re-throw produces no
  misleading "recovered" signal. ✓
- **Detection mechanism**: uses `error.name`, never `instanceof` against a library error
  class and no deep import of `yahoo-finance2` internals — exactly as the plan requires
  (and as ADR-15 / the AGENT.md fragile-surface entry document why). ✓
- **Per-call-site guards match the plan's boundaries exactly:**
  - `fundamental-analysis.service.ts:108` — throws when the wrapper return is nullish OR
    both `price` AND `summaryDetail` are absent, **before** `extractMetrics` and
    `saveToDatabase`. An all-null row can never be persisted/cached for 24h. ✓
  - `market-data.service.ts:57` — existing `if (!quote || !quote.price) throw` guard
    still fires against the wrapper's return. ✓
  - `analyst-ratings.service.ts` — no hard module guard added; a missing
    `recommendationTrend` flows to the existing `totalAnalysts: 0 → neutral score 5`
    path (`:113`). Correct asymmetry, and it is explained in an inline comment. ✓
- **Typing deviation** (local `interface QuoteSummaryQueryOptions { modules: string[] }`
  instead of the library's own option type): purely a compile-time choice forced by the
  same `exports`-map limitation that drives the `error.name` detection. No runtime or
  behavioral impact; the value passed to `quoteSummary` is unchanged. ✓

### Doc drift & test coverage (step 3) — PASS
- **ADR-15** (`DECISIONS.md:110`): well-formed, `Status: accepted`, `Confidence: High`,
  Evidence cites real `file:line` for all four code sites and the four test files. ✓
- **AGENT.md fragile-surface entry** (`:36`): thorough — names the wrapper as the single
  sanctioned entry point, the `error.name`-not-`instanceof` rule and why, the three
  routed call sites, the per-service guard asymmetry, and the warn-log-as-bump-signal. ✓
- **ARCHITECTURE.md**: one-line chokepoint note added per the plan. ✓
- **Tests (10 new, 93/93 total pass under `vitest run`, no live Yahoo):**
  - `lib/yahoo-finance.test.ts` mocks `yahoo-finance2`'s default export and covers all
    four wrapper paths (coerced-result + single warn with the drifted field path in the
    message; nullish-result re-throw with no warn; non-validation re-throw with no warn;
    happy path). Genuine assertions, not smoke. ✓
  - `fundamental-analysis.service.test.ts`: the empty-result path asserts BOTH
    `rejects.toThrow` AND `upsertMock` `not.toHaveBeenCalled` (`:64`) — directly proving
    the no-all-null-row-persisted guarantee. ✓
  - `market-data` / `analyst-ratings` service tests cover the coerced-partial and
    guard-boundary behaviors per the plan's acceptance checks. ✓

### Standing checklist (step 4) — PASS
- Working tree clean at review time (`git status --porcelain` empty).
- STATUS.md within limits (≤20 lines, links only, no narrative).
- Files conform to template structures (ADR format, TECH_DEBT untouched, INDEX rows).
- No secrets in tracked files; `.env`/`scratch` gitignored; secret-scan step passes.
- Verify block present and runnable — `npm run verify` green (typecheck · lint ·
  93/93 tests · secret-scan no leaks). Pre-existing lint warnings only; none new.

## Findings detail

### YV-S1 — SUGGESTION
**File:** `lib/yahoo-finance.ts:43-74` (and the three call-site guards)
**Problem:** The guards protect against a critical module being **absent** (`!price`,
`!price && !summaryDetail`). They do not protect against a critical module being
**present but structurally malformed** — e.g. `price` exists but
`price.regularMarketPrice` is a string/`null`/`NaN` after coercion. In that case the
coerced `error.result` passes the presence guard, and the extractors' `|| null`
fallbacks convert the bad field to `null`, which then flows into the scoring's
graceful-degrade (neutral) path. This is the *intended* degrade behavior and does not
produce a wrong-but-plausible **number** (a null metric degrades, it does not
miscompute) — so it is not an ISSUE. It is called out only so the boundary is on record:
the fix guarantees "no all-null row persisted" and "no silent wrong number," not
"every returned metric is fully validated." That stronger guarantee was explicitly out
of scope per the plan (and would require re-validating individual coerced fields, which
defeats the point of falling back to `error.result`).
**Recommendation:** No action required to merge. If field-level trust ever becomes a
requirement, add targeted `typeof`/`Number.isFinite` checks on the handful of fields the
scoring is most sensitive to (e.g. `regularMarketPrice`, `trailingEps`) rather than
blanket re-validation — but only if a real miscompute is observed. Leave as-is otherwise.

## Proposed DECISIONS.md entries
None — ADR-15 was authored with the implementation and is accurate as written.
