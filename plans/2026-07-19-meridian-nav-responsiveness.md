# Plan: Meridian navigation responsiveness — instant redirect, progressive component loading
Date: 2026-07-19

## Problem

Reported by the owner: on a cold open of Meridian, clicking a position row or a nav
item (Closed positions, Watchlist, …) leaves the screen frozen for ~1s. Then the
destination renders as empty boxes with no text, before finally filling in as
components load. The desired behaviour: navigation feels instant — the destination
route paints its skeleton immediately, and individual components stream in.

### Root cause (verified against code)

The lag has two independent causes, both confirmed in the source:

1. **The dashboard group layout blocks the whole subtree on a server-side session
   check.** `app/(dashboard)/layout.tsx:6-15` is an `async` Server Component that
   `await`s `getServerSession(authOptions)` and calls `redirect("/login")` before
   returning any JSX — including the shared `<Navigation>` and `{children}`.

   In the App Router, a segment's `loading.tsx` wraps that segment's **children** in
   a Suspense boundary, but **not the layout component itself**. So while the layout's
   `await` is in flight, neither `loading.tsx` nor `<Navigation>` can paint — the
   screen is frozen. This is the "does nothing for ~1s" window. The check is also
   redundant: `middleware.ts:5-12` already validates the JWT via `getToken()` and
   redirects unauthenticated users to `/login` for every non-API page route (matcher
   at `middleware.ts:21-23`). The layout re-does a strictly weaker version of a check
   the middleware already guarantees, and pays a per-navigation server round-trip for
   it. (`getServerSession` here decodes/verifies the JWT; with a warm module cache
   this is cheap, but on a cold serverless invocation the layout module — which pulls
   in `lib/auth.ts` → Prisma client, bcrypt — is initialised before the first byte of
   UI can stream. That cold path is the ~1s.)

2. **Closed-positions rows navigate with a full-page browser reload.**
   `app/(dashboard)/portfolio/closed-positions/page.tsx:284` uses
   `window.location.assign(\`/research/${position.ticker}\`)` instead of the client-side
   `router.push` that every other table uses (`components/positions-table.tsx:61`).
   `window.location.assign` tears down the SPA and triggers a fresh document load:
   re-download + re-parse of the JS bundle, a fresh SSR of the group layout (which
   then re-runs cause #1's blocking session check), and a cold React Query cache. This
   is the worst-case instance of the same "dead, then empty, then filled" sequence and
   the only nav in the app that behaves this way.

The "empty boxes with no text" that appear *after* the frozen window are the
destination page's own shell: every dashboard page is a client component that renders
its layout chrome immediately, then fills content once its React Query fetches resolve
(e.g. `dashboard/page.tsx:32-41`, `closed-positions/page.tsx:49-67`). Route-level
`loading.tsx` skeletons already exist for all six dashboard routes and are well-built
(`app/(dashboard)/**/loading.tsx`, composed from `components/ui/loading-skeleton.tsx`)
— but cause #1 prevents them from ever showing during a group-internal navigation,
because the layout above them is what is blocking, not the child segment. Once cause
#1 is removed, those existing skeletons paint instantly on navigation, which is
exactly the "responsive, immediately goes to the redirect page even though some
components are still loading" behaviour the owner asked for.

## Approach

Two scoped changes, ordered so the highest-impact fix lands first. No data-model,
scoring, or auth-policy change — auth remains enforced by `middleware.ts` exactly as
ADR-2 describes; this plan only stops a redundant *second* enforcement from blocking
render.

### 1. Make the dashboard layout non-blocking (primary fix)

Remove the `await getServerSession` / `redirect` from `app/(dashboard)/layout.tsx`.
The layout becomes a synchronous Server Component that returns the `<Navigation>` +
`<main>{children}</main>` shell with no server round-trip in its render path. Auth is
already guaranteed upstream by the middleware (which runs before the layout on every
matched route), so no page in this group can be reached by an unauthenticated user —
removing the layout's own check changes no observable auth behaviour, it only removes
the render-blocking wait.

Because the layout no longer suspends, on any client-side navigation within the group
(nav links, `router.push` from tables) Next.js swaps the child segment and shows that
segment's `loading.tsx` **immediately** while the destination page's client bundle and
data resolve. `<Navigation>` stays mounted and painted across the transition (it lives
in the persistent layout). That is the instant-redirect behaviour requested.

This is a deliberate, non-obvious decision (removing a session guard) — captured as
**ADR-16** below, with the rationale that the middleware is the single source of truth
for page-route auth and the layout guard was both redundant and render-blocking.

Edge case to preserve: the middleware matcher (`middleware.ts:22`) excludes only
`api`, `_next/static`, `_next/image`, `favicon.ico`. Every `(dashboard)` route is
covered, so there is no page in this group the middleware does not gate. Verify this
holds (no new exclusions) as part of the acceptance check rather than assuming it.

### 2. Convert the closed-positions row navigation to client-side routing

Replace `window.location.assign(...)` at
`app/(dashboard)/portfolio/closed-positions/page.tsx:284` with the `useRouter().push`
pattern already used by `components/positions-table.tsx:61`. Add the `useRouter` import
and hook to the page. This makes clicking a closed-position row a client-side
transition — the research-detail `loading.tsx` skeleton
(`app/(dashboard)/research/[symbol]/loading.tsx`) shows immediately, no full document
reload, warm React Query cache — instead of a cold full-page load.

### What is explicitly NOT in scope

- No change to the six existing `loading.tsx` skeletons or `loading-skeleton.tsx`
  primitives — they are already correct and become effective once cause #1 is fixed.
  The Designer stage should confirm they read well now that they actually appear on
  intra-group navigation (they previously only appeared on hard/first loads), but no
  new skeleton work is anticipated.
- No change to per-page React Query fetching, `staleTime`, or `usePriceSync`
  (governed by ADR-13 — untouched).
- No change to auth policy, middleware matcher, or the route-handler guards (ADR-2).
- No `ComponentErrorBoundary` coverage expansion (a separate known gap in `AGENT.md`
  fragile surfaces — mention only, do not fix here).

## Tasks

1. [ ] Make `app/(dashboard)/layout.tsx` non-blocking: remove the
   `getServerSession`/`authOptions`/`redirect` imports and the `await` + `if (!session)
   redirect` block; return the `<Navigation>` + `<main>` shell directly. Keep it a
   Server Component (no `"use client"`). — Acceptance: the file no longer imports
   `next-auth`/`redirect`; `grep -n "getServerSession\|redirect" app/(dashboard)/layout.tsx`
   returns nothing. `npm run verify` passes (typecheck confirms no dangling `session`
   references).

2. [ ] Manually confirm auth still gated: with no valid session cookie, requesting any
   `(dashboard)` route (`/dashboard`, `/wishlist`, `/portfolio/closed-positions`,
   `/research/AAPL`) still 307-redirects to `/login` via middleware. — Acceptance:
   `curl -sI localhost:3000/dashboard` (or Playwright with cleared cookies) returns a
   redirect to `/login`; an authenticated session reaches the page normally.

3. [ ] Convert closed-positions row navigation to client-side: add `useRouter` from
   `next/navigation` to `app/(dashboard)/portfolio/closed-positions/page.tsx` and
   replace `window.location.assign(\`/research/${position.ticker}\`)` (line ~284) with
   `router.push(\`/research/${position.ticker}\`)`. — Acceptance:
   `grep -n "window.location" app/(dashboard)/portfolio/closed-positions/page.tsx`
   returns nothing; clicking a closed-position row transitions without a full page
   reload (Network tab shows no top-level document request; the research-detail
   skeleton flashes).

4. [ ] Behavioural verification (Playwright): from a warm session on `/dashboard`,
   click each nav item and a position row; confirm the destination's `loading.tsx`
   skeleton paints within the same frame as the click (no blank/frozen window) and
   `<Navigation>` never unmounts. — Acceptance: recorded interaction shows skeleton
   visible immediately on click for Closed / Watchlist / Research and a position row,
   with the masthead/nav persistent throughout. See Verification.

[Task status markers — the Coding agent maintains these in this file as it works:]
[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `app/(dashboard)/layout.tsx` — remove blocking session check; return shell directly.
- `app/(dashboard)/portfolio/closed-positions/page.tsx` — swap `window.location.assign`
  for `router.push`; add `useRouter` import/hook.
- `DECISIONS.md` — add ADR-16 (below).
- `ARCHITECTURE.md` — update the "Request flow" section: note that page-route auth is
  enforced solely by `middleware.ts`; the dashboard layout no longer re-checks the
  session (cross-reference ADR-16).
- `AGENT.md` — add a "Known fragile surfaces" entry: the dashboard group layout must
  stay non-blocking; do not reintroduce a server-side session `await` there (it
  re-freezes navigation) — auth belongs in the middleware.

## Verification

`npm run verify` (the AGENT.md `## Verify` block) runs typecheck + lint + tests +
secret scan and must pass. Beyond it:

- **Auth-gate manual check (Task 2):** unauthenticated request to a `(dashboard)`
  route redirects to `/login`; authenticated request reaches the page. This is the one
  behaviour the layout change could regress, so verify it explicitly, not just by
  typecheck.
- **Navigation responsiveness (Task 4, Playwright):** on a warm session, clicking
  Closed / Watchlist / Research and a position row shows the destination `loading.tsx`
  skeleton immediately (same frame, no frozen window), the masthead/nav stays mounted,
  and content streams in after. Confirm the closed-position row no longer triggers a
  full-page reload (no top-level document request in the Network panel).
- No new tests are strictly required for a two-line behavioural change, but if the
  Coding agent adds a middleware/auth-gate integration test it should assert the
  redirect-when-unauthenticated path (the invariant the layout previously duplicated).

## Notes for the Designer stage

This plan touches navigation UX but adds **no new visual components** — the fix makes
the six existing route-level `loading.tsx` skeletons actually appear during
intra-group navigation (today they only show on a hard/first load). The Designer's job
here is confirmation, not new tokens:

- Visual states now newly-visible on every intra-group navigation: the route-level
  skeletons at `app/(dashboard)/{dashboard,wishlist,research,research/[symbol],
  portfolio/closed-positions,portfolio/[ticker]}/loading.tsx`, all composed from
  `components/ui/loading-skeleton.tsx` (`SkeletonBlock`/`SkeletonCard`/`SkeletonStatBand`/
  `SkeletonTable`/`SkeletonTabBar`/`SkeletonText`) against DESIGN.md tokens.
- Designer to confirm: (a) each skeleton's shape still matches its now-shipped page
  layout closely enough that the swap from skeleton → content is not a jarring
  reflow; (b) the `animate-pulse` opacity-only shimmer (DESIGN.md: no sweep/gradient
  motion vocabulary) reads well at the very short durations these will now show for;
  (c) the persistent `<Navigation>` masthead sitting above a pulsing skeleton body is
  visually coherent. No new token, color, or spacing value should be introduced — if
  the Designer finds a skeleton genuinely mismatched, that is a skeleton-markup tweak
  referencing existing tokens, logged as its own small follow-up.

## Assumptions

- The middleware (`middleware.ts`) is the intended and sufficient single enforcement
  point for page-route auth — consistent with ADR-2 ("middleware gates all page
  routes… every route handler authorises itself"). Removing the layout's redundant
  guard therefore changes no security posture; it removes a duplicate check, not the
  check. If the owner intended defence-in-depth (belt-and-suspenders session check in
  the layout *in addition to* middleware), that would need to be reintroduced as a
  **non-blocking** pattern (e.g. a Suspense-wrapped server component), not the current
  render-blocking `await` — but nothing in the docs indicates that intent, so this
  plan treats the middleware as sufficient.
- Every `(dashboard)` route is covered by the middleware matcher (verified: matcher
  excludes only `api`/`_next`/`favicon`, none of which are dashboard pages). No route
  in this group becomes reachable-while-unauthenticated as a result of the layout
  change.
- The perceived ~1s freeze is dominated by the layout's blocking render path (cause
  #1) plus, for closed-positions specifically, the full-page reload (cause #2). If
  after both fixes a residual delay remains before content (as opposed to the
  skeleton), that residual is the per-page React Query fetch latency, which is
  expected and already covered by the skeleton — it is not the reported freeze and is
  out of scope for this plan.

## Open decisions

None. Both changes are within the existing architecture (ADR-2 middleware auth, ADR-13
client-side fetching) and the auth-policy implication is captured in ADR-16 for the
owner to confirm at plan approval.

---

## Proposed DECISIONS.md entry

## ADR-16 — Page-route auth is enforced only in middleware; the dashboard layout does not re-check the session
- **Decision:** `app/(dashboard)/layout.tsx` no longer calls `getServerSession` +
  `redirect`. Page-route authentication is enforced solely by `middleware.ts`
  (`getToken()` → redirect to `/login`), which runs before the layout on every matched
  route. The layout is a synchronous Server Component that renders the `<Navigation>` +
  `<main>` shell with no server round-trip in its render path.
- **Evidence:** not-implemented at plan time — will be `app/(dashboard)/layout.tsx`
  (post-change: no `next-auth`/`redirect` import), `middleware.ts:5-23` (the sole
  surviving page-route gate).
- **Tradeoffs:** removes a defence-in-depth second check — if the middleware matcher
  were ever narrowed to exclude a dashboard route, that route would become
  unauthenticated with no layout-level backstop. Accepted because (a) the middleware is
  already the documented single source of truth for page-route auth (ADR-2), (b) the
  layout's `await` blocked the entire dashboard subtree — including the shared nav and
  every route's `loading.tsx` — from painting until it resolved, which was the primary
  cause of the reported navigation freeze, and (c) any future defence-in-depth check
  here must be non-blocking (Suspense-wrapped), not a render-gating `await`.
- **Status:** proposed
- **Confidence:** High — the middleware-covers-all-dashboard-routes fact is verifiable
  from the matcher, and the layout guard was strictly redundant with it.
