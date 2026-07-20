# Plan: Gemini model update — restore AI features (fix `gemini-1.5-flash` 404)

Date: 2026-07-20

## Problem

Both AI features are down in production. The app calls Google's Gemini API with
model `gemini-1.5-flash`, which Google has **retired** (the Gemini 1.5 family was
deprecated and removed). Every `generateContent` call now returns:

> `[404 Not Found] models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent.`

This breaks the two AI-powered features in `PRODUCT.md`:
- **News sentiment scoring** (`lib/services/sentiment.service.ts`) — used across the
  research news tab and the per-symbol daily sentiment history.
- **Daily portfolio insight** (`app/api/insights/portfolio/route.ts`).

The fix is to point both call sites at a **current, supported** Gemini model. The
trap is picking another unavailable name and reintroducing the outage — so the
replacement was **live-verified against the real API and installed SDK**, not
guessed (see Verification).

## Root cause (confirmed by live probe)

The model name `gemini-1.5-flash` no longer exists on the `v1beta` endpoint the
installed SDK targets. Confirmed by running the installed SDK against the real
`GEMINI_API_KEY` (probe script, run 2026-07-20):

| Model tried (installed `@google/generative-ai@0.24.1`, real key) | Result |
|---|---|
| `gemini-1.5-flash` | **FAIL — 404** (the reported outage, reproduced) |
| `gemini-2.0-flash` | **FAIL — 429** (exists, but quota/tier-unavailable on this key — NOT a safe pick) |
| `gemini-2.5-flash` | **PASS — 200**, returned generated text |
| `gemini-flash-latest` | **PASS — 200** |

The `ListModels` endpoint (same key, same `v1beta`) lists `gemini-2.5-flash`,
`gemini-2.0-flash`, `gemini-flash-latest`, `gemini-2.5-flash-lite`,
`gemini-3.5-flash` and others as `generateContent`-capable. But *listed* is not
*callable on this key* — `gemini-2.0-flash` is listed yet returns 429. Only a
live `generateContent` call proves a model works for us.

**Chosen replacement: `gemini-2.5-flash`.** It is the current flash-tier model
(cheap/fast, matching the app's existing tier choice), it is a **pinned stable
name** (not a floating `-latest` alias, so behaviour won't silently shift under
us), and it returned a clean **200** live through the installed SDK with the
production key. `gemini-flash-latest` also works but is rejected as a floating
alias; `gemini-2.0-flash` is rejected because it 429s on this key today.

## Scope / decisions settled by the probe

- **No SDK migration.** The installed `@google/generative-ai@0.24.1` (the final
  release of the legacy SDK, since superseded by `@google/genai`) successfully
  calls `gemini-2.5-flash` against `v1beta`. This is a **model-string change
  only**, not a library migration — verified end-to-end, not assumed. (An
  eventual migration to `@google/genai` is a separate, larger task; noted under
  Follow-ups, not done here.)
- **Centralize the model name.** Today the string is hardcoded in two places
  (`sentiment.service.ts:30`, `insights/portfolio/route.ts:73`), plus a stale
  comment. `AGENT.md` and `TECH_DEBT.md` TD-12 already flag "the model must
  change in both places" as a drift risk. This plan introduces a single exported
  constant `GEMINI_MODEL` so a future model change is one edit and the two sites
  can never diverge again. This is a small, clean improvement directly on the
  path of the fix — included, not deferred.
- **No Designer stage.** This is a backend/config fix. No UI changes — the AI
  output renders into existing, unchanged UI (the news sentiment display and the
  insights card). The orchestrator should **skip the Designer stage.**
- **No ADR.** This is a simple model-string update plus a one-constant
  centralization — no non-obvious architectural decision. (An ADR would only be
  warranted if this required the SDK migration, which the probe ruled out.) The
  model-selection reasoning is captured here in the plan; `AGENT.md` and TD-12
  are updated to point at the constant.

## Approach

1. Add a single shared constant for the model name so both call sites reference
   one source of truth:
   ```ts
   // lib/services/gemini.ts (new)
   export const GEMINI_MODEL = 'gemini-2.5-flash';
   ```
   Kept minimal — just the constant. (A fuller "one shared client" consolidation
   is TD-12's larger ask and is intentionally NOT bundled here; this constant is
   the drift-prevention piece that the outage fix naturally motivates. See
   Follow-ups.)
2. Point both Gemini call sites at `GEMINI_MODEL`:
   - `lib/services/sentiment.service.ts:30`
   - `app/api/insights/portfolio/route.ts:73`
3. Update the stale comment block at `insights/portfolio/route.ts:67-72` (it
   currently asserts "both call sites now use gemini-1.5-flash") to reference the
   constant instead of a hardcoded, now-wrong model name.
4. Update `AGENT.md`'s "Two independent Gemini client instantiations" fragile-
   surface entry and `TECH_DEBT.md` TD-12 to reflect that the model name is now a
   shared constant (change it in one place), and that `gemini-1.5-flash` was
   retired.

### Graceful degradation (already present — noted, not the core fix)

Both call sites already degrade on an AI failure, and this is why the outage
surfaced as degraded/empty AI output rather than 500s to the user:
- `insights/portfolio/route.ts` — the `if (!geminiKey)` branch returns a
  placeholder, and the inner `try/catch` (lines 117–131) catches *any*
  `generateContent` failure (including the 404) and returns the transient "AI
  analysis temporarily unavailable" payload **without persisting it** (AUD-10).
  So the 404 was caught here; it did not crash the route.
- `sentiment.service.ts` — `analyzeSentiment`'s `try/catch` (lines 77–87) returns
  a neutral sentiment on any error, so a 404 silently produced neutral scores.

This means the model-not-found error **already degrades gracefully** — the raw
Google error is logged server-side (`console.error`) but not surfaced to the
user. The core fix (a working model) is what actually restores the feature; no
change to the degradation paths is required. **One observation for the owner, not
in scope here:** because sentiment failures degrade *silently* to neutral, an
outage like this produces plausible-but-wrong neutral scores with no user-visible
signal — that's an existing observability gap (a candidate `TECH_DEBT.md` item),
not something this outage fix should expand into. Left as a note.

## Tasks

1. [ ] Add `lib/services/gemini.ts` exporting `GEMINI_MODEL = 'gemini-2.5-flash'`.
   — Acceptance: `node -e "import('./lib/services/gemini.ts')"` not needed;
   `npm run typecheck` passes and `grep GEMINI_MODEL lib/services/gemini.ts`
   shows the constant with value `gemini-2.5-flash`.
2. [ ] Point `lib/services/sentiment.service.ts` at the constant — import
   `GEMINI_MODEL`, replace the literal at line 30 with `{ model: GEMINI_MODEL }`.
   — Acceptance: `grep -n "gemini-1.5-flash" lib/services/sentiment.service.ts`
   returns nothing; the `getGenerativeModel` call references `GEMINI_MODEL`.
3. [ ] Point `app/api/insights/portfolio/route.ts` at the constant — import
   `GEMINI_MODEL`, replace the literal at line 73, and correct the stale comment
   (lines 67–72) so it no longer claims the model is `gemini-1.5-flash`.
   — Acceptance: `grep -rn "gemini-1.5" app/ lib/` returns **zero** occurrences
   (string *and* comments); the call references `GEMINI_MODEL`.
4. [ ] Add a unit test asserting both call sites request the current model.
   Mock `@google/generative-ai` (`getGenerativeModel` as a spy) and assert it is
   called with `{ model: 'gemini-2.5-flash' }` — for sentiment.service via
   `analyzeSentiment`, and (if practical to invoke in isolation) for the insights
   route; at minimum test the constant's value and the sentiment path.
   — Acceptance: `npm run test` includes a test that fails if the model string
   reverts to `gemini-1.5-flash` or the constant changes unexpectedly.
5. [ ] Live-probe confirmation (documented, re-runnable by the Coding agent).
   Re-run the throwaway `scratch/` probe (or the two `curl` one-liners in
   Verification) with the real key to confirm `gemini-2.5-flash` returns 200
   through the installed SDK before opening the PR. Do **not** commit `scratch/`.
   — Acceptance: the probe prints `PASS gemini-2.5-flash` / HTTP 200; recorded in
   the PR body. (Planner already ran this 2026-07-20 — see Verification. The
   Coding agent re-confirms after wiring the constant, since network/quota state
   can change.)
6. [ ] Update `AGENT.md` (Two-Gemini-clients fragile surface) and `TECH_DEBT.md`
   TD-12 to reference the shared `GEMINI_MODEL` constant and note 1.5's retirement.
   — Acceptance: `grep -n "GEMINI_MODEL" AGENT.md TECH_DEBT.md` returns matches;
   neither file still instructs "change the model in both places" as two edits.

Task markers: `[ ]` todo · `[~]` in progress · `[x]` done (acceptance passed) ·
`[!]` blocked. Work them in order; the Coding agent maintains these here.

## Files to create or modify

- **Create:** `lib/services/gemini.ts` (single-constant module).
- **Create:** a unit test (e.g. `lib/services/gemini.test.ts` or fold into
  `lib/services/sentiment.service.test.ts` if it exists) — see Task 4.
- **Modify:** `lib/services/sentiment.service.ts` (line 30 → constant).
- **Modify:** `app/api/insights/portfolio/route.ts` (line 73 → constant;
  comment 67–72 corrected).
- **Modify:** `AGENT.md` (Gemini fragile-surface entry).
- **Modify:** `TECH_DEBT.md` (TD-12 wording).
- **Do NOT commit:** `scratch/` (gitignored per guardrail 7).

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically —
typecheck + lint + tests + secret-scan; all must pass. Beyond it:

- **No stale model string anywhere:** `grep -rn "gemini-1.5" app/ lib/` returns
  nothing (this is the "partial fix leaves one site 404-ing" guard).
- **Live model check (the decisive one).** Confirm the replacement actually works
  through the installed SDK with the real key. Planner ran this 2026-07-20:
  ```
  # installed @google/generative-ai@0.24.1, real GEMINI_API_KEY from .env
  gemini-1.5-flash   -> FAIL 404   (reproduces the outage)
  gemini-2.0-flash   -> FAIL 429   (rejected candidate)
  gemini-2.5-flash   -> PASS 200   (chosen)
  gemini-flash-latest-> PASS 200   (rejected: floating alias)
  ```
  Equivalent one-liner the Coding agent can re-run (key from `.env`, not printed):
  ```bash
  KEY=$(grep -E '^GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d "\"' ")
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}" \
    -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"ok"}]}]}'
  # expect: 200
  ```
- **Manual UI check:** open the portfolio dashboard insights card (with at least
  one position) and a research news tab — the AI insight populates and news
  sentiment scores render as non-neutral where the content warrants, rather than
  the "temporarily unavailable" placeholder / uniform neutral scores.

## Assumptions

- `gemini-2.5-flash` remains available on the production key at deploy time. It
  was live-verified 2026-07-20; Task 5 re-confirms at implementation time. If it
  ever 429s/404s later, the fix is a one-line change to `GEMINI_MODEL` — which is
  the whole point of centralizing it.
- The free-tier quota that let `gemini-2.5-flash` return 200 is sufficient for
  the app's actual call volume (batched sentiment + one daily insight per user).
  No quota change is in scope; if quota becomes the limiter that is a separate
  billing/tier decision for the owner, not a model-name bug.
- Dev and prod share one key (ADR-6-adjacent) — verifying against `.env` is
  verifying against production. No separate prod key to test.

## Open decisions

None — the model choice is verified, no SDK migration is needed, and no ADR is
required. Ready for a Coding agent session.

## Follow-ups (not in scope here — logged, not done)

- **TD-12 full consolidation:** collapse the two separate `new GoogleGenerativeAI(...)`
  instantiations into one shared client. This plan does the model-name half
  (shared constant); the shared-client half remains TD-12's larger ask.
- **Eventual SDK migration** `@google/generative-ai` → `@google/genai` (Google's
  current SDK; the installed one is EOL-track). Not needed for this fix — a
  separate Planner task when convenient.
- **Silent-degradation observability:** sentiment failures degrade to neutral
  with no signal; consider a `TECH_DEBT.md` item so a future model outage is
  detectable rather than producing plausible-but-wrong neutral scores.
