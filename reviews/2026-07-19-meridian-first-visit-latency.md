# Review: Enable Turbopack for the dev server (first-visit route-compile freeze)
Date: 2026-07-19
Status: IMPLEMENTED — 2026-07-19

## Summary
Findings: [0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 1 QUESTION]
Requires owner decision: FVL-Q1 (resolved 2026-07-21 — Turbopack dev confirmed; dev-only, no prod impact; owner-accepted)
Ready for Coding agent: FVL-S1 (optional; no-action acceptable)

Scope note: this branch (`feature/meridian-nav-responsiveness`, PR #17) also carries the
already-IMPLEMENTED nav-responsiveness work (`reviews/2026-07-19-meridian-nav-responsiveness.md`)
and the merged yahoo-validation fix. This review covers **only** the new change from
`plans/2026-07-19-meridian-first-visit-latency.md` — commit `a55edaa1` (the Turbopack
dev-script flag plus its doc updates). The prior work was not re-reviewed.

## Findings

### FVL-Q1 — QUESTION — RESOLVED (owner-accepted 2026-07-21)
**Resolution:** Confirmed 2026-07-21: `package.json` dev script is `next dev --turbopack` — the fix is in place. This is a dev-only concern (first-visit on-demand route compilation; never affected production, which pre-compiles all routes at build), so there is no production/user-facing behavior to accept; Turbopack shrinks the dev first-compile below perceptibility. Owner accepted on the basis of the confirmed mechanism + own dev experience.
**File:** `plans/2026-07-19-meridian-first-visit-latency.md:101-126` (Task 3), `package.json:6`
**Problem:** The plan's real acceptance (Task 3) is perceptual: that the multi-hundred-ms
"frozen-before-skeleton" window on a *first* in-app navigation to a cold route is no longer
perceptible. That claim is timing/perception-based and cannot be asserted from the code diff or
the Verify block. No Playwright project is wired into this repo (`playwright` is an unused dev
dependency — no `playwright.config.ts`, no `.spec.ts`), so no automated timing measurement exists.
The Coding agent handed Task 3 to the owner, exactly as NAV-Q1 was handled on this same branch.
**Recommendation:** Owner performs a click-through on a cold `npm run dev` server — first
navigation (via in-app `<Link>`, not a hard reload) to `/portfolio/closed-positions`, `/wishlist`,
`/research`, and a position-detail page — and confirms each route's `loading.tsx` skeleton now
appears without a visible frozen gap. Objective corroboration already collected and independently
plausible: server-side first-compile times under Turbopack were 647ms (`/dashboard`), 252ms
(`/wishlist`), 258ms (`/portfolio/closed-positions`) — well under the plan's ~1s webpack baseline
and inside its stated ~100-200ms-typical improved range. This is compile time, not perceived
browser-freeze duration, so it is corroborating, not conclusive. Assessment: the deferral is
**acceptable** — the objective evidence supports it and the change is a supported one-flag dev-only
swap with no rollback cost; this is an owner-acceptance QUESTION, not an ISSUE, consistent with the
NAV-Q1 precedent. Not a blocker to marking the plan implemented once the owner confirms.

### FVL-S1 — SUGGESTION
**File:** repo test infrastructure (no `playwright.config.ts`)
**Problem:** Two consecutive plans on this branch (nav-responsiveness NAV-Q1, now first-visit
FVL-Q1) have had their real, perceptual acceptance criteria deferred to a manual owner check
because there is no automated way to measure navigation/first-paint timing. `playwright` sits in
`package.json` as an unused dev dependency. This is a recurring gap, not a defect in this change.
**Recommendation:** No action required for this plan. If perceptual navigation timing keeps being
the acceptance bar, consider a separate Planner-scoped task to stand up a minimal Playwright
project (webServer config + one first-navigation spec asserting the skeleton element appears within
a small budget on a cold server) so future nav/latency work can be verified automatically rather
than handed to the owner each time. Out of scope for this one-line change — do not expand this PR.

## Assessment against the five-step review

**Security (Step 1).** A dev-only bundler flag (`next dev --turbopack`) has no security surface: it
does not touch the production `build`/`start` scripts, auth, data flow, network calls, input
handling, secrets, or crypto. The `security-review` skill run and an independent read of the diff
found no new attack surface. `next.config.js` remains vanilla (no `webpack()` fn, only
bundler-agnostic `serverExternalPackages`/`eslint.dirs`), so nothing security-relevant is silently
dropped under Turbopack. Verify's secret-scan step reports no leaks. No findings.

**Correctness (Step 2).** Verified independently against the code, not just the diff description:
- `package.json:6` reads exactly `"dev": "next dev --turbopack"`; `build` (`next build`) and
  `start` (`next start`) are byte-for-byte unchanged. `git show a55edaa1 -- package.json` is a
  single changed line.
- `--turbopack` is a valid, documented flag for the installed Next.js **15.5.4** (`next dev --help`
  lists `--turbopack` — "Starts development mode using Turbopack"; installed version confirmed
  15.5.4 via `node_modules/next/package.json`).
- The plan's central compatibility claim holds: `next.config.js` is vanilla — **no `webpack()`
  function** (grep-confirmed), only `serverExternalPackages` (`@prisma/client`, `bcryptjs`,
  `yahoo-finance2`), `eslint.dirs`, and an empty `typescript` block, all bundler-agnostic.
  `grep` across `app/`/`components/`/`lib/` found zero `webpack` references and zero
  SVG-as-component imports, matching the ADR-17 evidence. There is genuinely nothing that would be
  silently dropped under Turbopack.
- ADR-17 accurately describes what shipped: it is stamped `implemented` with `package.json:6`
  evidence, the live-boot banner (`Next.js 15.5.4 (Turbopack)`), compile-time numbers, and a
  correct statement that prod is untouched. The remaining perceptual claim is explicitly flagged
  owner-verifiable in the ADR itself.

**Doc drift + test coverage (Step 3).**
- ADR-17 conforms to the DECISIONS.md ADR template (Decision / Evidence / Rationale / Tradeoffs /
  Status: accepted / Confidence: High) and its Evidence was moved from `proposed` to `implemented`
  with concrete file:line + boot evidence — accurate.
- `ARCHITECTURE.md` Stack note is accurate: dev on Turbopack via `next dev --turbopack` (ADR-17),
  `build`/`start` on the default production bundler.
- `AGENT.md` fragile-surface note is accurate and useful: dev runs Turbopack; `next.config.js` must
  stay free of a `webpack()` function (a bare `webpack()` would apply to `next build` but silently
  not to `next dev`), needing a `turbopack`/`experimental.turbo` equivalent if ever required.
- Test coverage: a dev-script flag has **no unit-testable runtime surface** — there is no function
  or route to test. Absence of a test here is **acceptable**, not a missing-test ISSUE. The Verify
  block does not exercise the dev server; the change-specific verification is the Coding agent's
  reported live dev-boot (Turbopack ready banner, three routes compiled 252-647ms with no
  bundler/PostCSS error, served stylesheet carrying Meridian tokens). That is the right evidence for
  this class of change.

**Standing checklist (Step 4).**
- Working tree clean — `git status --porcelain` empty at review start.
- STATUS.md within limits — 11 lines, links-only, no narrative, no custom sections.
- Files conform to templates — ADR-17 matches the ADR format; `plans/INDEX.md` correctly shows the
  plan as `in review` (NOT prematurely `implemented` — correct, since this review does not yet carry
  `Status: IMPLEMENTED`); STATUS.md conforms.
- Secrets — no keys/tokens/credentials in the diff; gitleaks secret-scan passed (no leaks).
- Verify block present and runnable — `npm run verify` re-run green: typecheck ok, lint ok,
  **93/93 tests (21 files)**, secret-scan clean.

## Proposed DECISIONS.md entries
None. ADR-17 already covers this change and was authored by the Planner in this cycle; no new or
amended ADR is warranted.
