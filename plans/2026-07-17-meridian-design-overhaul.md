# Plan: Meridian design overhaul
Date: 2026-07-17

## Problem

The app ships stock shadcn/ui defaults: a blue-accented, `bg-gray-50`, Inter-everywhere look with no documented token system (`DESIGN.md` is a `[REQUIRES INPUT]` stub from the 2026-07-16 onboarding audit). The Meridian handoff (`design_handoff_meridian/`) specifies a high-fidelity newspaper-editorial identity — warm near-monochrome palette, centered masthead, serif figures, ruled stat bands, flat/no-shadow surfaces — across the 7 screens the app already has.

This is a **re-skin, not new functionality**. Every screen in the design maps onto an existing route. No data model, API, or scoring logic changes.

The overhaul's success hinges on one integration decision: the app's theming is shadcn HSL-triple CSS variables (`--background: 0 0% 100%`) consumed as `hsl(var(--background))` with `darkMode: ["class"]`; Meridian specifies hex/oklch values (`--bg:#faf8f4`, `--up:oklch(0.55 0.1 155)`) with `data-theme="dark"`. These are incompatible as written, and 20 components under `components/ui/` depend on the current mechanism. Getting this wrong means hand-patching every component; getting it right reskins them for free.

## Approach

### The central decision: collapse the two token systems into one (ADR-8)

**Meridian tokens become the single source of truth, mapped INTO the shadcn variable names.** The `hsl()` wrapper is removed from `tailwind.config.js` so variables hold complete colors instead of bare HSL triples.

Two facts, both verified against this codebase during planning, make this the clear choice:

1. **`hsl()` cannot parse hex or oklch.** `hsl(#faf8f4)` and `hsl(oklch(...))` are both invalid CSS. Keeping the wrapper would force every Meridian value to be converted to an HSL triple — which is lossy for the oklch tokens (`--up`/`--dn`/`--amber` are outside sRGB-safe HSL and are the design's only chromatic accents), and would silently degrade exactly the colors that carry gain/loss meaning.
2. **The `hsl()` wrapper exists in exactly one file.** `grep` for `hsl(var(--` across `components/ui/*.tsx` returns nothing — every component uses the Tailwind aliases (`bg-card`, `text-muted-foreground`, `border-border`), which `tailwind.config.js` resolves. So the wrapper is one file's concern, not 20 components' concern.

Therefore: change `'hsl(var(--border))'` → `'var(--border)'` in `tailwind.config.js`, and set `--border` (etc.) to Meridian's actual colors in `globals.css`. All 20 `components/ui/` files then inherit the Meridian palette with **zero edits** — Radix primitives (dialog, select, dropdown, toast, popover…) included.

Alternatives rejected:
- **Parallel token set** (Meridian vars alongside shadcn vars) — two palettes to keep in sync forever; every component becomes a judgment call about which system it belongs to; guarantees drift. This is the failure mode the constraint warns about.
- **Convert Meridian to HSL triples, keep the wrapper** — smallest diff, but lossy on the three oklch accents and permanently blocks the design's stated color space. Rejected on fidelity.

**Theme switch mechanism:** keep `darkMode: ["class"]` and the `.dark` class; do **not** adopt `data-theme="dark"`. The prototype's `data-theme` is an artifact of a framework-less prototype. `.dark` is what Tailwind's `dark:` variant and shadcn already use, and `next-themes` drives it by default. Adopting `data-theme` would mean a custom Tailwind variant plus rewiring — pure cost, zero visual difference. This is a mechanism swap, not a design change; the rendered result is byte-identical.

**Token naming:** keep the shadcn names as the canonical set (`--background`, `--card`, `--border`…) since 20 components already reference them, and add the Meridian-only tokens that have no shadcn equivalent (`--ink`, `--sub`, `--mut`, `--line2`, `--fill`, `--up`, `--dn`, `--amber`, `--btnbg`, `--btnfg`) as new variables exposed through `tailwind.config.js`. Meridian's `--bg`→`--background`, `--card`→`--card`, `--line`→`--border`/`--input`, `--ink`→`--foreground`.

### Fonts

`app/layout.tsx` already uses `next/font/google` (`Inter`), so the pattern is established — swap it, don't introduce a new mechanism. Load `Libre_Franklin` and `Newsreader` via `next/font/google` with CSS variables (`--font-sans`, `--font-serif`), wire both into `tailwind.config.js` `fontFamily`, and drop `Inter`. `next/font` self-hosts and eliminates the layout shift a raw Google Fonts `<link>` (as the prototype uses) would cause. Newsreader needs italics + optical sizing (`opsz`), per the handoff.

### Theme persistence + toggle

`next-themes` is **not** a dependency (verified in `package.json`). Add it rather than hand-rolling: the hand-rolled version of this is a `useEffect` + `localStorage` read that flashes the wrong theme on first paint. `next-themes` solves the FOUC with a pre-hydration inline script and is the standard shadcn pairing. Add `<ThemeProvider attribute="class">` inside `components/providers.tsx` (which already exists and already nests SessionProvider + QueryClientProvider), and `suppressHydrationWarning` on `<html>`.

### Charts — Tremor is a red herring; the app uses Recharts

**Correcting the brief:** `@tremor/react` is in `package.json` but has **zero imports** — `grep` for `@tremor/react` across `app/` and `components/` returns nothing. Both charts (`components/portfolio-chart.tsx`, `components/price-chart.tsx`) are **Recharts**. Tremor is dead weight (a TECH_DEBT entry, not a task for this plan).

The real question is whether Recharts can meet the spec. Assessment: **partially — and the gap is exactly the two things the design leads with.**

- Smooth Catmull-Rom path: Recharts `type="monotone"` is a *different* interpolation (monotone cubic — it deliberately suppresses overshoot). It looks close but is not the specified curve.
- ~500ms range-morph: Recharts animates on data change via `isAnimationActive`, but morphs by re-rendering, not by interpolating between two 20-point series the way the prototype's `requestAnimationFrame` loop does.

Given the design is declared **high-fidelity / "recreate pixel-perfectly"**, and the prototype already contains a complete, dependency-free implementation (`buildPath()` — Catmull-Rom→bezier, ~10 lines; plus a 500ms eased rAF morph), the plan **replaces the dashboard Recharts area chart with a purpose-built inline SVG chart** ported from that prototype logic. This is *less* code than the current Recharts usage, removes a rendering dependency from the hero surface, and matches the spec exactly.

Scope boundary: **only `portfolio-chart.tsx` (the dashboard hero) gets the custom SVG.** `price-chart.tsx` (research detail) keeps Recharts and is retokenized only — the design's research-detail chart is a static presentation with no range tabs, and its axes/tooltips are worth more than pixel-parity there. This keeps the risky rewrite to one component.

`buildPath` and the currency-conversion helper are the two genuinely testable units this overhaul produces (see Test strategy).

### Naming: "Wishlist" vs "Watchlist"

The design says **Watchlist**; the app says **Wishlist** everywhere — route (`/wishlist`), component files, service (`wishlist.service.ts`), Prisma models (`Wishlist`, `WishlistItem`), and API routes. "Watchlist" is also the correct domain term (you watch a stock; you don't wish for it), and `PRODUCT.md` describes the feature as "Watch up to 50 stocks".

**Decision: rename user-visible copy only.** Nav label, H1, and button copy become "Watchlist". The route, files, service, and schema stay `wishlist`. Renaming the route and Prisma models is a migration against a database that dev and prod **share** (ADR-6) — real risk, zero visual payoff, and out of scope for a re-skin. Logged as tech debt for a future dedicated pass. Recorded as ADR-9.

### Register page (not covered by the design)

The design covers Login but not Register. Leaving it stock would strand a visibly 2019-era page one click from a redesigned Login. **Restyle it by applying the Login screen's spec** — same 420px centered column, same masthead block with double rule, same card, same field/label/button treatment. This is extrapolation within the design's own established patterns, not invention: every token and component it needs is specified by the Login screen. Noted in `## Assumptions`.

### Scoring surfaces — presentational only

Per the owner: the watchlist Score column and research-detail score breakdown are **restyled to render whatever the current scoring code returns**. No scoring logic changes. The open scoring-methodology review (`reviews/2026-07-17-scoring-methodology.md`, SCM-01..25, 3 unanswered QUESTIONs) is **out of scope and must not be touched**.

One concrete interaction to preserve: `wishlist-table.tsx:150-154` has a `getScoreColor` helper with **three** bands (`>=7` green, `>=5` yellow, `<5` red, plus null→gray). Meridian specifies **≥7 green, 4–7 amber, <4 red** — different thresholds. This is a *presentation* band, not scoring logic (it recolors an already-computed number), so the Coding agent should retokenize it to Meridian's bands and colors. Flagged explicitly because it is the one place where "presentational only" and "don't touch scoring" could be misread as "don't touch this file".

### Shared masthead

`components/navigation.tsx` is replaced by the Meridian masthead: sticky, 3-col top row (dateline kicker / centered "Meridian" wordmark / search + theme toggle + account), plus a centered nav row below. It currently renders "InvestTracker" + a blue `TrendingUp` logo + horizontal icon nav. The dateline ("Vol. III — № 128 · Friday, 17 July 2026") is a **live-formatted date**, not a hardcoded string — the issue number is decorative and static, the date is `date-fns` (already a dependency).

**Dateline formula (owner-specified).** The dateline is fully computed from the current date — nothing hardcoded:
- **Volume** = the 2-digit year in Roman numerals. 2026 → `26` → `XXVI`.
- **Issue №** = day-of-year (`date-fns` `getDayOfYear`). 17 July 2026 → `198`.
- **Date** = the existing long-form date, e.g. `Friday, 17 July 2026`.

Today renders: `Vol. XXVI — № 198 · Friday, 17 July 2026`.

Chosen over the month/day alternative (`Vol. V — № 17`) because it behaves like a real masthead: the volume tracks the publication's life and the issue number counts up through it before resetting each January, giving every issue a unique dateline. Month-as-volume resets 12×/year, caps the issue number at 31, and restates the date that already sits beside it in the same line. The prototype's own `Vol. III — № 128` matches neither formula and is placeholder text (the handoff states all prototype figures are sample data); this formula supersedes it.

Roman-numeral conversion is a small pure function — put it in `lib/utils/dateline.ts` and test it (see Verification).

The account dropdown (Radix `DropdownMenu`, with real `signOut()`) is **kept** — the prototype's account circle just navigates to login, which is prototype shorthand for "sign out", not a spec to drop the menu. Same for `<Link>`-based nav: keep Next.js routing, take Meridian's styling.

### Out of scope

- `app/page.tsx` (marketing landing page) — not among the 7 screens, not behind auth. Untouched.
- `app/(dashboard)/portfolio/[ticker]/page.tsx` (position detail) — not among the 7 screens. Untouched this pass; logged as debt (it will look stock-shadcn against a reskinned app — accepted, and called out in Assumptions).
- Any scoring logic. Any API/service/schema change. `design_handoff_meridian/` is gitignored reference material and is not committed.

## Tasks

Ordered so the token/theme foundation lands before any screen depends on it. Tasks 1–4 are the foundation; 5–11 are screens and can be verified independently once the foundation is green.

1. [x] **Tokens + theme mechanism.** Rewrite `app/globals.css` `:root`/`.dark` blocks with Meridian values (both themes, full token set incl. `--ink`/`--sub`/`--mut`/`--line2`/`--fill`/`--up`/`--dn`/`--amber`/`--btnbg`/`--btnfg`, mapped onto the existing shadcn names where equivalent). Remove the `hsl()` wrapper from every color in `tailwind.config.js` (`'hsl(var(--x))'` → `'var(--x)'`) and add the Meridian-only tokens as aliases. Add the `body` background/color 0.25s transition.
   — **Acceptance:** `npm run verify` passes; `npm run dev` renders the dashboard with the warm `#faf8f4` page background and `#fffdf9` cards, no blue/gray-50 anywhere; toggling `.dark` on `<html>` in devtools swaps to `#171411`/`#1e1a15`. All 20 `components/ui/` files remain unedited (`git diff --stat components/ui/` is empty).

2. [x] **Fonts.** Replace `Inter` in `app/layout.tsx` with `Libre_Franklin` + `Newsreader` via `next/font/google` (Newsreader: italics + `opsz`), expose as `--font-sans`/`--font-serif`, wire into `tailwind.config.js` `fontFamily` (`sans`, `serif`).
   — **Acceptance:** `npm run verify` passes; devtools computed style on body text is Libre Franklin, on an `.font-serif` element is Newsreader; no network request to `fonts.googleapis.com` (proving self-hosting); no CLS on hard reload.

3. [x] **Theme provider + persistence.** `npm i next-themes`; add `<ThemeProvider attribute="class" defaultTheme="light">` inside `components/providers.tsx`; add `suppressHydrationWarning` to `<html>` in `app/layout.tsx`.
   — **Acceptance:** `npm run verify` passes; setting theme, hard-reloading, and confirming the choice persists with **no flash** of the wrong theme on first paint.

4. [x] **Masthead header.** Rewrite `components/navigation.tsx` to the Meridian masthead (sticky, dateline via `date-fns`, centered wordmark → `/dashboard`, search input, theme toggle wired to `next-themes` `useTheme()`, account dropdown retained with real `signOut()`, centered nav with active-state underline). Nav label "Wishlist" → "Watchlist". Update `app/(dashboard)/layout.tsx`: drop `bg-gray-50`, apply the 1400px / `56px 32px 96px` container.
   — **Acceptance:** `npm run verify` passes; header renders per spec on all 6 authed screens; theme toggle flips light/dark and persists; active nav item is ink + 2px underline on each route; account dropdown still signs out.

5. [x] **Dashboard.** Hero (kicker, 54px serif value, today's change in `--up`/`--dn`, italic "as of" line), currency segmented control (EUR/USD pill — replaces the `CurrencySelector` Select on this screen), ruled 3-col stat band, positions table with two-line position cells + Meridian row hover, insights strip restyled to "The Morning Note" (drop caps, ruled 3-col risks/opportunities/recommendations). Restyle `components/positions-table.tsx`, `components/portfolio-insights.tsx`, `components/currency-selector.tsx`.
   — **Acceptance:** `npm run verify` passes; `/dashboard` matches the design's dashboard screen; currency toggle still switches EUR/USD and values reconvert; row click still routes to research detail.

6. [x] **Portfolio chart.** Rewrite `components/portfolio-chart.tsx` as an inline SVG area chart: port `buildPath()` (Catmull-Rom→cubic bezier) into `lib/utils/chart-path.ts` as a pure exported function, ink line at 1.5px, `fill-opacity 0.05` area, 3 hairline gridlines, range tabs with active underline, 500ms eased rAF morph on range change. Keep the existing React Query `/api/portfolio/performance` data flow and all 10 existing ranges unchanged.
   — **Acceptance:** `npm run verify` passes including new `lib/utils/chart-path.test.ts` (see Verification); chart renders with a smooth curve; switching range animates the line over ~500ms rather than snapping; empty/loading/error states still render.

7. [x] **Closed positions.** Header + realized-to-date line, "⤓ Export CSV" secondary pill, 6-col summary card, ticker filter input restyled, All/Winning/Losing tabs, table with Opened/Closed/Held + two-line position cells. Restyle `components/closed-positions/ticker-filter.tsx`.
   — **Acceptance:** `npm run verify` passes; `/portfolio/closed-positions` matches the design; CSV export still downloads; ticker filter still filters; win/loss numbers unchanged from before the reskin.

8. [x] **Watchlist.** Header ("Under observation · before you invest" / H1 "Watchlist"), 3-col ruled stat band (targets reached / watched N of 50 / average score), 13-col table with `min-width:1180px` horizontal scroll, Score column emphasized (Newsreader 19px), "TARGET REACHED" outlined badge, 28px circular row-action buttons. Retokenize `getScoreColor` (`components/wishlist-table.tsx:150-154`) to Meridian bands: ≥7 `--up`, 4–7 `--amber`, <4 `--dn`, null `--mut`. Restyle `components/wishlist-table.tsx`, `components/wishlist-item-card.tsx`, `components/add-to-wishlist-modal.tsx`. **No scoring logic changes.**
   — **Acceptance:** `npm run verify` passes; `/wishlist` matches the design; sorting still works on every column; add/remove still mutate; the score *values* rendered are identical to pre-reskin (only their color/typography changed).

9. [x] **Research index + detail.** Index: centered kicker/H1/italic subline, large serif pill search, "Popular this week" 3-col card, 3 discipline cards. Detail: company header, 4-col stat card, section tabs, retokenized `price-chart.tsx` (Recharts retained), score breakdown (84px composite figure, rotated double-ruled verdict stamp, 5-dimension ruled grid, "Key insights" №-numbered list). Restyle `components/stock-search.tsx`, `components/technical-analysis.tsx`, `components/fundamental-analysis.tsx`, `components/intrinsic-value.tsx`, `components/analyst-ratings.tsx`, `components/sentiment-score.tsx`, `components/news-feed.tsx`, `components/overview.tsx`. **Score breakdown is presentational only.**
   — **Acceptance:** `npm run verify` passes; `/research` and `/research/AAPL` match the design; search still navigates; all analysis tabs still load their data; scores render current values unchanged.

10. [x] **Add position.** 680px container, "← Portfolio" back kicker, form card, price/total tab pair with 2px ink underline, italic serif helper text, order summary with the 3px double-rule total row, equal-width Cancel/Add pills. Restyle `components/buy-more-modal.tsx` and `components/sell-position-modal.tsx` for consistency (they share the form surface).
   — **Acceptance:** `npm run verify` passes; `/portfolio/add` matches the design; submitting still creates a position; per-share/total-amount toggle still computes the same total; validation errors still display.

11. [x] **Login + Register.** Login per spec (420px, masthead block with double rule, card, kicker labels, remember-me with ink `accent-color`, pill sign-in). Register: same treatment extrapolated (see Approach).
   — **Acceptance:** `npm run verify` passes; `/login` matches the design; sign-in still authenticates and redirects to `/dashboard`; invalid credentials still show an error; `/register` is visually consistent with `/login` and still creates an account.

12. [x] **Docs.** Populate `DESIGN.md` (replacing the `[REQUIRES INPUT]` stub) with the Meridian tokens, type scale, component patterns, and tone. Add ADR-8 (token reconciliation), ADR-9 (Watchlist naming), ADR-10 (custom SVG chart) to `DECISIONS.md`. Add tech-debt rows: unused `@tremor/react` dependency; `wishlist`→`watchlist` code/schema rename; `portfolio/[ticker]` page unreskinned. Update `ARCHITECTURE.md` (UI stack: Tremor→Recharts correction, next-themes, next/font) and `AGENT.md` (token system as a fragile surface).
   — **Acceptance:** `npm run verify` passes; `DESIGN.md` has no `[REQUIRES INPUT]` marker; `grep -rn "@tremor/react" app components` returns nothing while the dependency remains listed in `TECH_DEBT.md`.

## Files to create or modify

**Create**
- `lib/utils/chart-path.ts` — Catmull-Rom→bezier path builder (pure)
- `lib/utils/chart-path.test.ts` — unit tests
- `components/theme-toggle.tsx` — theme toggle control

**Modify — foundation**
- `app/globals.css`, `tailwind.config.js`, `app/layout.tsx`, `components/providers.tsx`, `package.json` (+`next-themes`, −`Inter` usage)

**Modify — shell**
- `components/navigation.tsx`, `app/(dashboard)/layout.tsx`

**Modify — screens**
- `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/portfolio/closed-positions/page.tsx`, `app/(dashboard)/wishlist/page.tsx`, `app/(dashboard)/research/page.tsx`, `app/(dashboard)/research/[symbol]/page.tsx`, `app/(dashboard)/portfolio/add/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`

**Modify — components**
- `portfolio-chart.tsx` (rewrite), `price-chart.tsx` (retokenize), `positions-table.tsx`, `wishlist-table.tsx`, `wishlist-item-card.tsx`, `portfolio-insights.tsx`, `currency-selector.tsx`, `closed-positions/ticker-filter.tsx`, `stock-search.tsx`, `overview.tsx`, `technical-analysis.tsx`, `fundamental-analysis.tsx`, `intrinsic-value.tsx`, `analyst-ratings.tsx`, `sentiment-score.tsx`, `news-feed.tsx`, `add-to-wishlist-modal.tsx`, `buy-more-modal.tsx`, `sell-position-modal.tsx`

**Modify — docs**
- `DESIGN.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `AGENT.md`, `TECH_DEBT.md`

**Explicitly NOT modified**
- `components/ui/**` (the point of ADR-8 — if this directory needs edits, the token mapping is wrong; treat it as a signal to re-check Task 1, not to patch)
- `app/page.tsx`, `app/(dashboard)/portfolio/[ticker]/page.tsx`, all `lib/services/**`, all `app/api/**`, `prisma/schema.prisma`

## Verification

`npm run verify` (AGENT.md) runs automatically and must pass at every task boundary. Beyond it:

**Test strategy — what is worth testing here.** This is a presentational change; appearance is verified by eye, not by assertion. The project has **no component-test infrastructure** (`vitest.config.ts` is `environment: "node"`, `include: ["**/*.test.ts"]` — no `.tsx`; jsdom and `@testing-library` are both absent). Standing up jsdom + RTL to assert on class names would test Tailwind, not our logic — high maintenance, near-zero signal. **Do not add snapshot tests, and do not add jsdom.**

Worth testing (pure, logic-bearing, `.test.ts`, runs in the existing node environment):
- `lib/utils/chart-path.ts` — `buildPath()`: known input → expected SVG path string; 2-point and single-point series (degenerate, must not divide by zero); flat series (`max - min === 0` → the `|| 1` guard); NaN/empty input. This is real math with real edge cases and is the one new algorithm the overhaul introduces.

Not worth testing: token values (a CSS constant restated in a test asserts nothing), component rendering, theme toggling (next-themes' own behavior), visual appearance.

**Manual checks (the real verification for this plan)** — for each of the 7 screens, in both light and dark:
1. Screen matches the design bundle side by side (open `design_handoff_meridian/Meridian Hybrid.dc.html` in a browser next to the running app).
2. Every pre-existing behavior still works — enumerated per-task in the acceptance checks above.
3. Theme toggle: no flash on hard reload; persists across reloads; both palettes correct on every screen.
4. Score values on `/wishlist` and `/research/[symbol]` are **numerically identical** to pre-reskin (compare against `main`). Only color/typography may differ.
5. `git diff --stat components/ui/` is empty — the ADR-8 proof.
6. Dashboard chart: range switching morphs smoothly over ~500ms.

## Assumptions

- **Register page** gets the Login screen's treatment applied by extrapolation (same tokens, same patterns, no new design decisions). Alternative was leaving it stock, which strands it visually one click from a redesigned Login.
- **`data-theme` → `.dark`** is a mechanism substitution with an identical rendered result; the design's intent is preserved exactly.
- **The dateline** ("Vol. III — № 128") renders a live date via `date-fns`; the volume/issue number is decorative and static. The prototype's date is hardcoded because prototypes are.
- **`portfolio/[ticker]` (position detail)** stays stock-shadcn this pass. It is not one of the 7 screens, but it is reachable from the dashboard, so it will look inconsistent until a follow-up. Logged as tech debt rather than silently expanded into scope.
- **The 3 discipline cards** on Research index (Technical/Fundamental/Intrinsic) are presentational; they link into the existing research flow rather than introducing new routes.
- **Currency toggle** on the dashboard is EUR/USD only per the design, replacing the 8-currency `CurrencySelector` **on that screen's hero**. The underlying `/api/portfolio/currency` preference and the other 6 currencies are unchanged — if a user has CHF set, the segmented control shows their currency rather than silently rewriting it to EUR.

## Open decisions

None. The three owner decisions (full-overhaul scope, presentational-only scoring surfaces, existing branch) are settled; the token-reconciliation call is made above in ADR-8 on verified evidence.
