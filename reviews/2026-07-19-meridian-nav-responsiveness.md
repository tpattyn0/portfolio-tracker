# Review: Meridian navigation responsiveness — instant redirect, progressive component loading
Date: 2026-07-19
Status: IMPLEMENTED — 2026-07-19

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 1 QUESTION
Requires owner decision: NAV-Q1 (resolved 2026-07-21 — non-blocking layout + skeletons verified in code; live nav goes straight to content, no frozen window; owner-accepted)
Ready for Coding agent: NAV-S1 (optional)

Reviewed branch HEAD of `feature/meridian-nav-responsiveness` against `main`. The scoped change is two code edits (`app/(dashboard)/layout.tsx`, `app/(dashboard)/portfolio/closed-positions/page.tsx`) plus doc updates (ADR-16, ARCHITECTURE.md request flow, AGENT.md fragile surface). The branch diff also contains the already-merged-and-reviewed yahoo-validation work (`lib/yahoo-finance.ts`, the three service files + tests, ADR-15) — out of scope here, reviewed under `reviews/2026-07-18-yahoo-validation-error.md`; not re-reviewed.

Verify block run independently on branch HEAD: **pass** — typecheck ok · lint ok (pre-existing warnings only, none new on touched files) · 93/93 tests · secret-scan `no leaks found`.

## Findings

### NAV-Q1 — Navigation responsiveness — RESOLVED (owner-accepted 2026-07-21)
**Resolution:** Verified 2026-07-21. Code: `app/(dashboard)/layout.tsx` is a synchronous component with zero `getServerSession` calls (the render-blocking `await` removed, ADR-16), and route-level `loading.tsx` skeletons exist for the dashboard routes (dashboard/research/settings/wishlist). Live: clicking an in-app nav link (Watchlist → Research) transitioned straight to loaded content with the masthead/nav persistent throughout — no frozen blank layout window. The ~100ms warm transition was too fast to freeze a mid-transition skeleton frame in a single screenshot, but that is the intended outcome (no dead window). Owner accepted.
**Type:** QUESTION
**File:** plans/2026-07-19-meridian-nav-responsiveness.md (Task 4), app/(dashboard)/layout.tsx
**Problem:** The whole point of this change is a *perceived* UX improvement — clicking a nav item or position row should paint the destination `loading.tsx` skeleton immediately instead of freezing ~1s. The Coding agent could not run the live Playwright behavioural check (no test credential available; registering one would be an unscoped mutation against the shared dev/prod DB per ADR-6), so Task 4 is marked `[!]` blocked. The mechanism is sound and independently corroborated: the removed `await getServerSession()` was the only render-blocking call in the layout's path, and Next.js's documented rendering hierarchy (`layout → template → error → loading (Suspense) → page`) means a non-blocking layout cannot delay a child segment's `loading.tsx` fallback. So the fix is *correct by construction* — but "correct by construction" is not the same as the owner having seen the freeze actually gone. This is a QUESTION, not an ISSUE, because there is no code defect to fix; it is an acceptance gap the owner closes by eyeballing it.
**Recommendation:** Before or right after merging PR #17, do a manual click-through on a warm session (open Meridian, click Closed positions / Watchlist / Research / a position row) and confirm: (a) the destination skeleton appears in the same frame as the click, no frozen window; (b) the `<Navigation>` masthead never unmounts across the transition; (c) clicking a closed-position row no longer triggers a full-page reload (no top-level document request in the Network panel). If all three hold, the goal is met. No code change expected.

### NAV-S1 — No automated regression guard against reintroducing a blocking layout await
**Type:** SUGGESTION
**File:** app/(dashboard)/layout.tsx
**Problem:** The one way this fix silently regresses is a future edit reintroducing a render-blocking `await` (e.g. a session check, a feature-flag fetch) into the dashboard layout — which would re-freeze navigation across the whole group. This is well-documented as a fragile surface in AGENT.md and ADR-16, but documentation is the only guard; nothing fails a build if someone adds the await back. Given the change itself is a two-line behavioural edit that legitimately needs no unit test, this is a "nice to have", not a gap that should block merge.
**Recommendation:** Optionally add a lightweight test asserting `app/(dashboard)/layout.tsx` exports a **non-async** component (e.g. `expect(DashboardLayout.constructor.name).not.toBe("AsyncFunction")`) or an ESLint guard, so a future blocking-await reintroduction fails CI rather than only re-freezing navigation in production. Low priority; the AGENT.md note is the primary defence and is sufficient for now.

## Detailed pass notes

**Security (Steps 1) — clean.** The removed layout guard was strictly redundant with `middleware.ts`, whose matcher `"/((?!api|_next/static|_next/image|favicon.ico).*)"` covers every `(dashboard)` route (verified: none of the seven dashboard routes begin with an excluded prefix). `getToken()` redirects unauthenticated requests to `/login` before the layout renders; API routes authorize independently (ADR-2). No dashboard route becomes reachable-while-unauthenticated. The `router.push(\`/research/${position.ticker}\`)` target is an internal hardcoded path with a non-attacker-controlled segment (server-supplied `position.ticker` from the authenticated user's own records) — no open-redirect/XSS surface. Auth-gate manually re-verified by the Coding agent via `curl` (307 → `/login` on all four sampled routes). ADR-16's premise holds.

**Correctness (Step 2) — clean.**
- `layout.tsx`: all four now-unused imports removed (`getServerSession`, `redirect`, `authOptions`, and the `async`/`await session`/`if (!session) redirect` block). No dangling `session` reference — typecheck would have caught one and it passes. Component remains a Server Component (no `"use client"`), now synchronous, returning the `<Navigation>` + `<main>{children}</main>` shell directly. Behaviourally identical for authenticated users; unauthenticated users are handled upstream by middleware exactly as before.
- `closed-positions/page.tsx`: `useRouter` imported from `next/navigation`, hook instantiated at the top of the component, `onClick` swapped from `window.location.assign` to `router.push` with the **identical** target string. Inspected the `<tr>` — its cells are display-only (no nested buttons/links needing `stopPropagation`), so the row-click semantics are unchanged; only full-reload → client-transition differs, which is the intended fix. This is now consistent with `components/positions-table.tsx:61`.

**Doc drift + test coverage (Step 3) — clean.** ADR-16 conforms to the ADR template (Decision/Evidence/Tradeoffs/Status/Confidence), is marked `accepted` (owner confirmed at plan approval), and its Evidence cites the real post-change file state. ARCHITECTURE.md's Request flow now correctly names middleware as the sole page-route auth enforcement point and cross-references ADR-16. AGENT.md's new fragile-surface entry accurately captures the "keep the layout non-blocking" invariant. DESIGN.md's skeleton note (from the Designer stage) documents route-level skeletons as a first-class navigation state using existing tokens only. Test coverage: a two-line behavioural nav change of this kind legitimately has no unit test — the correctness is structural (import removal + one-line call swap), fully covered by typecheck, and the behavioural claim is a runtime/perception property that a unit test cannot assert. Acceptable; the residual verification gap is captured as NAV-Q1 (manual) and NAV-S1 (optional automated guard).

**Standing checklist (Step 4) — all pass.**
- Working tree clean (`git status --porcelain` empty at review time).
- STATUS.md: 11 lines, links/pointers only, no custom sections, no narrative — within limits.
- Files conform to template structures: DECISIONS.md/ADR-16, STATUS.md, plans/INDEX.md (row set to `in review`), reviews/INDEX.md all well-formed.
- Secrets: no keys/tokens/credentials in tracked files; `.env`/`scratch` gitignored; secret-scan step passes (`no leaks found`).
- Verify block present in AGENT.md (single `npm run verify`) and runnable — confirmed green on branch HEAD.

## Proposed DECISIONS.md entries
None — ADR-16 already added by the Coding agent, correctly formatted and marked `accepted`.
