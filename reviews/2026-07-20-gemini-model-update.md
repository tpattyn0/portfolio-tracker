# Review: Gemini model update — restore AI features (fix gemini-1.5-flash 404)
Date: 2026-07-20
Status:

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 1 QUESTION
Requires owner decision: GMU-Q1 (owner UI acceptance — insights card + news sentiment populate live; not a code defect)
Ready for Coding agent: none — no actionable code findings

Reviewed the full branch diff (`origin/main...HEAD`; fresh branch, so the whole diff is this fix) for PR #20. Verify block re-run independently: **pass** — typecheck ok, lint ok (only pre-existing unused-`error` warnings, none new), **117/117 tests (24 files)**, secret-scan `no leaks found`.

> Process note: the `reviewer` subagent stopped after the security pass twice on this fix without writing the review file (a recurring failure of that agent on this project). The orchestrator completed Steps 2–5 directly and verified the correctness properties concretely against the diff. Security conclusion (carried from the subagent's pass, re-confirmed): clean — no secret in the diff, model string is a compile-time constant (no injection), insights route keeps its `getAuthenticatedUser()` guard, no new sensitive logging.

## Findings

### GMU-Q1 — Owner UI acceptance (live AI features render)
**Type:** QUESTION (manual acceptance, not a code defect)
**File:** app/api/insights/portfolio/route.ts, lib/services/sentiment.service.ts
**Problem:** The live-probe objectively proves the model works (HTTP 200 for `gemini-2.5-flash` through the installed SDK with the production key, recorded by the Coding agent and re-confirmed after wiring). What a static review cannot confirm is the end-user surface: that the dashboard AI insight card populates with a real summary (not the "temporarily unavailable" placeholder) and that news sentiment renders non-neutral where content warrants. This is an acceptance check, not a defect.
**Recommendation:** Owner opens the dashboard insights card (≥1 position) and a research news tab and confirms both populate. No code change expected.

## Detailed pass notes

**Security (Step 1) — clean.** Model name is a compile-time constant (`GEMINI_MODEL`), never user-controlled → no injection. No API key introduced into any committed file (the key stays read from `process.env.GEMINI_API_KEY`, unchanged); the test uses a dummy `"test-key"`; gitleaks passes. The insights route retains its `getAuthenticatedUser()` guard; graceful-degradation `try/catch` paths (which log the SDK error server-side, not the key) are unchanged.

**Correctness (Step 2) — clean, verified concretely against the diff.**
- **Fix completeness (the key property):** `grep -rn "gemini-1.5" app/ lib/` returns 4 hits, ALL inside the new `sentiment.service.test.ts` — a comment, a test name, a `.not.toHaveBeenCalledWith({ model: "gemini-1.5-flash" })` negative assertion, and a mocked 404 error string. **Zero** in any real call site. The outage cannot persist at a missed site.
- **Both call sites wired:** `sentiment.service.ts:31` and `insights/portfolio/route.ts:75` both call `getGenerativeModel({ model: GEMINI_MODEL })`, importing from the single `lib/services/gemini.ts` source. No literal remains.
- **Constant value:** `GEMINI_MODEL = 'gemini-2.5-flash'` — exactly the live-verified model (not `gemini-2.0-flash`, which 429s on this key; not a floating `-latest` alias). Well-documented with the retirement history.
- **Regression test is the strong kind:** it spies on the real `getGenerativeModel` mock, drives `analyzeSentiment(...)`, and asserts the call was made with `{ model: 'gemini-2.5-flash' }` AND explicitly `.not` with `gemini-1.5-flash` — so it fails if a call site regresses to the retired model (not merely a constant-value check). A second test asserts graceful degradation (neutral sentiment) on a simulated 404.
- **Stale comment corrected:** the `insights/portfolio/route.ts` comment block now references the shared constant, not a hardcoded `gemini-1.5-flash`.
- **Scope contained:** the diff does NOT do the TD-12 client consolidation (the two `new GoogleGenerativeAI(...)` instances remain separate), does NOT migrate the SDK, and does NOT alter the degradation paths — exactly as the plan scoped. No `scratch/`, no `.env`, no key committed.

**Doc drift + test coverage (Step 3) — clean.** AGENT.md's "Two independent Gemini client instantiations" fragile-surface entry accurately states the model is now a shared constant (one edit, not two), notes 1.5's retirement and the 2.5-flash replacement, and correctly preserves that the client-consolidation half is TD-12's remaining scope. TD-12 is narrowed accurately (constant-half done, client-half open) — not overclaiming. Test coverage is adequate for a config change: the sentiment call path is spied; the insights route's model call is guarded by grep + typecheck + the shared constant (a route-level unit test would be low-value here) — acceptable, not an ISSUE.

**Standing checklist (Step 4) — all pass.** Working tree clean; STATUS.md 11 lines (within limits, links only); DECISIONS/TECH_DEBT/plans/reviews index formats conform; no secrets in tracked files (gitleaks clean — the critical check given the probe touched the key); Verify block present and re-run green on branch HEAD. (Local note from the Coding agent: `prisma generate` may be needed locally to resync a stale generated client for an accurate typecheck — that is env drift, not part of the diff, and identical to main.)

## Proposed DECISIONS.md entries
None — the plan correctly determined no ADR is warranted (simple model-string change + one-constant centralization; the SDK migration was ruled out by the live probe).
