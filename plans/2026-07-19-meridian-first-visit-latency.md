# Plan: Enable Turbopack for the dev server (first-visit route-compilation freeze)
Date: 2026-07-19

## Problem

In local development (`npm run dev`), the **first** click to a dashboard route
(`/portfolio/closed-positions`, `/wishlist`, `/research`, a position detail page,
etc.) freezes the whole screen for several hundred milliseconds to ~1s — no
skeleton, nothing paints — then the page appears. Every subsequent visit to that
same route is instant.

This is **not** the same defect fixed on this branch by ADR-16 (the blocking
`await getServerSession()` in the dashboard layout, which froze *every*
navigation including warm ones). That fix is already in and landed the warm-path
freeze. The residual, confirmed here is a different, first-visit-only artifact.

**Confirmed diagnosis (not a guess):** under plain `next dev` (webpack), Next.js
compiles each route on demand the first time it is requested. Until that first
compile finishes, the route's JavaScript — *including its `loading.tsx` Suspense
fallback* — does not exist yet, so the browser has nothing to paint and the
screen sits frozen. The warm-on-repeat, no-skeleton, first-visit-only signature
is the textbook shape of dev on-demand compilation. It is absent in production
because `next build` pre-compiles every route ahead of time and `<Link>`
prefetches them; this app runs locally only (ADR-6/ADR-7/TD-01/TD-02 all predicate
on not-deployed), so the dev artifact is the whole of the user-visible symptom.

Owner-confirmed scope (answers to prior clarifying questions):
1. Target is **`npm run dev`** (webpack `next dev`), not the production build.
2. Symptom is a **whole-screen frozen window with no skeleton**, then paint;
   fast on every repeat visit to that route.
3. Chosen approach: **enable Turbopack dev** (`next dev --turbopack`). Dev-only;
   do not touch the production build.

## Approach

Change the `dev` script in `package.json` from `next dev` to
`next dev --turbopack`. Turbopack's dev bundler is the recommended, stable dev
bundler in Next.js 15 (installed version here is **15.5.4**, verified), and it
compiles on-demand routes dramatically faster than webpack (~1s → ~100–200ms
typical for a route of this size). That does not eliminate on-demand
compilation — dev still compiles a route the first time it is hit — but it
shrinks the first-compile window enough that the frozen gap before the skeleton
is no longer perceptible in normal use. This is the whole functional change.

**Turbopack compatibility — verified clean, no migration needed.** Turbopack
reads `next.config.js` but does **not** honor a custom `webpack()` config
function the way webpack does. This project has none. The investigation
(2026-07-19) confirmed:

- **`next.config.js` is vanilla** — it sets only `serverExternalPackages`
  (`@prisma/client`, `bcryptjs`, `yahoo-finance2`), `eslint.dirs`, and an empty
  `typescript` block. `serverExternalPackages` is a first-class Next.js config
  option honored by **both** bundlers (it is not a webpack customization), so it
  carries over unchanged. There is **no `webpack()` function**, no custom
  loaders, no plugins, no aliases. Nothing here needs a Turbopack (`turbopack` /
  `experimental.turbo`) equivalent.
- **PostCSS/Tailwind work natively.** `postcss.config.js` is the standard
  `tailwindcss` + `autoprefixer` pair — Turbopack supports PostCSS with Tailwind
  natively. Tailwind is **v3.3** with the `tailwindcss-animate` plugin loaded via
  a plain `require()` **inside `tailwind.config.js`** (not via any webpack
  config), so it is bundler-agnostic and applies identically under Turbopack.
- **No custom loaders needed.** `grep` across `app/`, `components/`, `lib/`
  found: zero `webpack` references in source, zero SVG-as-component imports
  (`from "*.svg"`), and no `@svgr`/`svg-loader`/`raw-loader`/`file-loader`
  dependencies. The only `next/font` usage is `next/font/google` in
  `app/layout.tsx` (Libre Franklin, Newsreader) — natively supported by
  Turbopack.

Conclusion: this is a clean one-line dev-script change. There is no webpack
customization substantial enough to constitute a Turbopack-migration decision,
so there are no Open decisions.

**Production is not touched.** The `build` (`next build`) and `start`
(`next start`) scripts stay exactly as they are. `--turbopack` applies only to
the `dev` script. The change cannot affect the production bundle, CI (which runs
`verify:code`, not the dev server), or deployed behavior.

**No UI/Designer stage needed.** This is a build-tooling change only — no new
screens, components, skeletons, or visual changes. It touches `package.json`
and docs. The orchestrator should skip the Designer stage.

## Tasks

1. [x] Change the `dev` script in `package.json` from `"next dev"` to
   `"next dev --turbopack"`. Leave `build`, `start`, and every other script
   unchanged. — **Acceptance:** `package.json` line 6 reads
   `"dev": "next dev --turbopack"`; `git diff package.json` shows exactly one
   changed line (the `dev` script) and no change to `build`/`start`.

2. [x] Boot the dev server and confirm Turbopack is active and routes compile
   without error. Run `npm run dev`, wait for the ready log, then request the
   home/dashboard route and at least two on-demand routes
   (`/wishlist`, `/portfolio/closed-positions`) so they trigger a first compile.
   — **Acceptance:** the startup log identifies Turbopack (Next 15.5.4 prints
   `Next.js 15.5.4 (Turbopack)` / `▲ ... Turbopack` in the ready banner); the
   server compiles each requested route and serves it with **no** Turbopack
   config error, no unsupported-loader error, and no PostCSS/Tailwind failure;
   styles render (Tailwind classes resolve). Capture the ready-banner line and a
   compiled-route line in the PR body. Stop the server after.

3. [!] Behavioural check — first-visit freeze is no longer perceptible.
   Navigate (via in-app `<Link>` clicks, not hard reloads) to
   `/portfolio/closed-positions`, `/wishlist`, `/research`, and a position
   detail page for the **first** time each, and confirm the multi-hundred-ms
   frozen-before-skeleton window is gone (the route's `loading.tsx` skeleton
   now appears effectively immediately, then content). — **Acceptance:** on a
   cold dev server, first navigation to each route shows its skeleton without a
   visible frozen gap. This is the real acceptance and is timing/perception-based;
   see Verification for how to frame it. **Owner verification may be required**
   (as with the ADR-16 nav-responsiveness check) — if the Coding agent cannot
   produce a confident automated timing measurement, it must still satisfy
   Task 2 (server boots under Turbopack, routes compile clean) and hand this
   perceptual check to the owner, noting it explicitly in the PR/summary.
   — **Blocked/handed to owner (2026-07-19):** no Playwright project is wired
   into this repo (no `playwright.config.ts`, no `.spec.ts` files — `playwright`
   is an unused dev dependency), and standing one up (webServer config, first
   spec, CI wiring) is infrastructure outside this plan's one-line-change scope.
   Per this task's own fallback clause, framed as an owner check exactly as
   NAV-Q1 was on this branch (`reviews/2026-07-19-meridian-nav-responsiveness.md`).
   Objective signal collected instead (server-side, via curl against an
   authenticated scratch session, cleaned up after — see Task 2 evidence): first
   compiles under Turbopack were 647ms (`/dashboard`), 252ms (`/wishlist`), 258ms
   (`/portfolio/closed-positions`) — well under the plan's ~1s webpack baseline
   and in its stated ~100-200ms-typical improved range. This is server compile
   time, not perceived browser freeze duration, so it is corroborating evidence,
   not a substitute for the owner's own click-through.

[Task status markers — the Coding agent maintains these in this file as it works:]
[ ] todo · [~] in progress · [x] done (acceptance check passed) · [!] blocked

## Files to create or modify

- `package.json` — change the `dev` script only (line 6).
- `DECISIONS.md` — add ADR-17 (below; the Planner adds it in this session).
- `ARCHITECTURE.md` — one-line note that dev uses Turbopack while prod build/start
  stay on the default bundler (Coding agent, per doc-mapping — Stack/tooling change).
- `AGENT.md` — optional: a one-line note under conventions that the dev server
  runs Turbopack and `next.config.js` must stay free of a `webpack()` function
  (adding one would silently not apply under dev Turbopack). Coding agent's
  discretion; not load-bearing for this change.

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs typecheck + lint +
tests + secret scan and must pass. Note that `npm run verify` does **not**
exercise the dev server — it validates the code gate, which this change does not
affect (no source code changes). It should pass unchanged.

Beyond the Verify block, the dev-server checks are the real acceptance:

- **Task 2 (bootable, deterministic):** `npm run dev` starts, the ready banner
  names Turbopack, and requesting the home route plus `/wishlist` and
  `/portfolio/closed-positions` compiles and serves them with no bundler error
  and correct styling. This is objectively checkable by the Coding agent and is
  the minimum bar for reporting the task done.
- **Task 3 (perceptual, owner-verifiable):** the first-visit frozen-before-
  skeleton window is gone. If the Coding agent can drive this via Playwright
  (navigate on a cold server, assert the skeleton element appears within a small
  budget), do so; otherwise frame it as an owner check, exactly as the ADR-16
  nav-responsiveness behavioural check was framed on this branch. A green Task 2
  plus an owner-confirmed Task 3 completes the plan.

## Assumptions

- Turbopack dev is stable/GA for this project's Next.js 15.5.4 and needs no
  additional dependency install — it ships inside `next`. (Verified: Next 15
  documents `next dev --turbopack` as the stable dev flag; the installed version
  is 15.5.4.)
- No developer or script depends on webpack-specific dev behavior. Nothing in
  the repo references webpack (grep-confirmed), and CI/prod use `next build`, not
  the dev server, so there is no shared surface that a dev-only bundler swap
  could regress.
- The residual first-visit freeze is on-demand dev compilation, per the
  confirmed diagnosis above — Turbopack shrinks it rather than removing
  compilation entirely, which the owner has accepted as the goal ("largely
  eliminated").

## Open decisions (if any)

None. The investigation confirmed there is no `webpack()` customization, no
custom loader, and no PostCSS/Tailwind incompatibility — so no
Turbopack-migration decision is required and nothing needs owner sign-off before
the Coding agent starts.
