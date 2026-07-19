# Plan: Visually distinguish the in-tab position stat band from the page-header market grid
Date: 2026-07-19

## Problem

On both stock detail routes — `/portfolio/[ticker]` and `/research/[symbol]` — the
page header renders a general-market stat grid (Current price / Day range / 52-week
range / Market cap) directly above the tab bar. When the **Positions** tab is active,
its position stat band (Shares held / Average cost / Market value / Unrealised P/L /
Realized P/L) renders just below that same tab bar. The two bands use the **identical
visual treatment**, so they read as one continuous, undifferentiated band with no
hierarchy separation between "page-header market data" and "your position data inside
the tab." The owner wants a visual distinction between them.

**Confirmation that they share the same styling (root cause):**
- Page-header market grid — `app/(dashboard)/research/[symbol]/page.tsx:177` and
  `app/(dashboard)/portfolio/[ticker]/page.tsx:245`:
  `grid grid-cols-4 rounded-lg border border-border bg-card` with `border-r
  border-line2` cell verticals; each cell = kicker `text-[10.5px] uppercase
  tracking-[0.12em] text-mut` over `font-serif text-[28px]` value.
- In-tab position band — `components/research/transactions-tab.tsx:112`:
  `grid grid-cols-4|5 rounded-lg border border-border bg-card` with `border-r
  border-line2` cell verticals; each cell = the **same** kicker
  (`text-[10.5px] uppercase tracking-[0.12em] text-mut`) over `font-serif text-[26px]`
  value.

The shared treatment causing the confusion: **same `bg-card` card wrapper, same
`border border-border` + `border-r border-line2` ruling, same `--mut` kicker style,
same serif-value treatment** (26px vs 28px is imperceptible). Neither band carries a
titling element, so nothing tells the eye where the header ends and the tab content
begins. This is DESIGN.md's "Ruled stat band" card-wrapped variant applied twice with
no differentiation.

## Approach

Give the **in-tab position band a titled, contained-panel treatment** so it reads as a
distinct "your position" section, while the **page-header market grid stays exactly as
is** (it is the reference — the bare titled-nothing market band on the page). The
distinction is achieved entirely with existing DESIGN.md vocabulary; no new token,
color, spacing value, or component is introduced.

Two existing-vocabulary levers, both already used elsewhere in this exact component:

1. **Section kicker heading (primary distinction — required).** Add a kicker eyebrow
   above the position band, e.g. **"Your position"** — 11px/600 uppercase,
   `tracking-[0.14em]`, `--ink` — the same titling pattern the Headline score card
   header and the "Your transactions" card **already inside this same file**
   (`transactions-tab.tsx:147`) use. DESIGN.md's Tone of voice makes this the house
   pattern: "Kickers over labels… Every screen's H1 gets one." The page-header market
   grid deliberately has no such kicker, so a titled band vs an untitled band is an
   immediate, idiomatic hierarchy cue. This alone resolves the "reads as one
   continuous band" problem.

2. **Surface swap to `bg-fill` (recommended reinforcement).** Render the position band
   on `bg-fill` (the `--fill` muted/secondary/accent **surface-fill** token, per
   DESIGN.md Colors) instead of `bg-card`. `--fill` over the page `--bg` reads as a
   contained tinted panel, visually distinct from the header's `bg-card` bare grid,
   while staying a warm neutral (no new accent — respects the "three chromatic accents
   only" rule). This is the same token the Row-hover and skeleton treatments already
   use, so it introduces nothing new.

**Recommended treatment:** the section kicker (lever 1) is the required, load-bearing
distinction; the `bg-fill` surface swap (lever 2) is the recommended reinforcement so
the distinction survives even when the header scrolls out of view. Whether to apply
lever 2 in addition to lever 1 — or to instead reinforce with a slightly different
in-vocabulary contained-panel cue — is deferred to the Designer stage (see "Notes for
the Designer stage"). The Coding agent must not pick tokens ahead of that spec.

**Explicitly rejected as over-heavy / out-of-vocabulary for this refinement:**
- A fourth accent hue / tinted-accent background — forbidden by the "three chromatic
  accents only" rule (DESIGN.md Colors).
- The editorial `border-t-[3px] border-double border-foreground` double rule — DESIGN.md
  reserves it for specific editorial cards (Morning Note, score breakdown, login
  masthead, order-summary total); applying it to a position stat band would overload a
  reserved emphasis marker and is heavier than this small refinement warrants.
- Any new spacing/type token — the distinction is achievable with existing tokens only.

**Scope:** the change lives entirely in `components/research/transactions-tab.tsx` (the
single shared tab body for both routes — ADR-18), so it applies to **both**
`/portfolio/[ticker]` and `/research/[symbol]` in one edit. The **closed-position
state** ("Position closed." + Realized P/L) receives a coherent treatment under the
same distinction so the tab reads as one titled section across all three states (see
Tasks). The page-header market grid on both route pages is **not touched**.

## Tasks

1. [ ] **Designer stage — spec the distinction treatment.** Before any code, the
   Designer produces the exact spec (heading text, kicker token/size/weight, whether
   `bg-fill` is applied, how the closed and held states share the treatment,
   confirmation the page-header grid stays as-is) per "Notes for the Designer stage"
   below, referencing only existing DESIGN.md tokens/components, and records it in
   DESIGN.md's "Research detail — tab-by-tab" item 6 (Positions).
   — Acceptance: DESIGN.md item 6 describes the position band's titled/surfaced
   treatment using named existing tokens; no new token/color/spacing is introduced; the
   spec explicitly states the page-header market grid is unchanged.

2. [ ] **Apply the section kicker heading to the held-state position band** in
   `components/research/transactions-tab.tsx` per the Designer spec — a kicker eyebrow
   (e.g. "Your position") above the `panelState === "held"` stat band, using the
   existing kicker pattern already in this file (matching "Your transactions" at
   `:147`), plus the specced surface treatment (e.g. `bg-fill` if the Designer selects
   it). Use only tokens named in the Designer spec / DESIGN.md.
   — Acceptance: with a held position, the tab shows a titled (and, if specced,
   `bg-fill`-surfaced) position band that is visually distinct from the page-header
   market grid; no hardcoded hex/oklch/spacing outside DESIGN.md tokens; `npm run
   verify` passes.

3. [ ] **Give the closed-position state a coherent treatment under the same
   distinction.** The `panelState === "closed"` block ("Position closed." caption +
   Realized P/L) should read as the same titled "your position" section as the held
   state — e.g. the same kicker heading sits above the closed caption per the Designer
   spec — so the distinction is consistent across states, not only in the held state.
   Keep the caption wording ("Position closed.") and the `hasRealizedPL` gating rule
   unchanged (ADR-18 / PT-I1 — do not re-gate Realized P/L on `quantity`).
   — Acceptance: the closed state renders the same section heading/treatment as the
   held state above its "Position closed." caption and Realized P/L line; realized-P/L
   visibility behavior is byte-for-byte the same rule as before (still
   `hasRealizedPL(position.realizedPL)`); `npm run verify` passes.

4. [ ] **Confirm both routes and the page-header grid.** Verify the distinction renders
   identically on `/research/[symbol]` and `/portfolio/[ticker]` (both consume the one
   shared `TransactionsTab`) and that neither route page's header market grid was
   modified.
   — Acceptance: manual check on both routes (see Verification) shows a clearly
   distinct in-tab position band; `git diff` touches only
   `components/research/transactions-tab.tsx` (plus DESIGN.md from Task 1), and does NOT
   touch the `grid grid-cols-4 … bg-card` header block in either route page.

## Files to create or modify

- `components/research/transactions-tab.tsx` — add the section kicker heading and the
  specced surface/panel treatment to the held- and closed-state position blocks
  (Tasks 2–3). This is the only source file changed.
- `DESIGN.md` — Designer updates "Research detail — tab-by-tab" item 6 (Positions) with
  the distinction spec (Task 1). Owned by the Designer stage.
- No route-page files change: `app/(dashboard)/research/[symbol]/page.tsx` and
  `app/(dashboard)/portfolio/[ticker]/page.tsx` headers are the reference and stay as-is.

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically — typecheck,
lint, tests, secret-scan. Beyond it, manual UI checks (both light and dark theme):

- `/portfolio/[ticker]` for a **currently held** ticker → open the **Positions** tab.
  The position band must be visibly distinct from the header market grid (titled and/or
  surfaced), with an unmistakable boundary between "page-header market data" and "your
  position." Confirm no visual regression to the header grid above.
- `/research/[symbol]` for the **same held** ticker → Positions tab renders the identical
  distinct treatment (shared component).
- A **fully-sold (closed) position** (`quantity === 0`, transactions on file) → Positions
  tab shows the same titled treatment above the "Position closed." caption and the
  Realized P/L line; Realized P/L still appears exactly when it did before.
- Sanity: a symbol where the Positions tab is present but the value happens to match a
  header value should no longer read as one continuous band.

## Assumptions

- **A1 — The header market grid is the reference and does not change.** The owner's ask
  is to differentiate the *tab content* from the header; the header is left as the
  canonical bare ruled market band. (Per task context; the header is the newer,
  intentionally-shared pattern from ADR-18.)
- **A2 — "Your position" is the working heading text.** A short kicker such as "Your
  position" (or a tone-of-voice-consistent equivalent the Designer prefers, e.g. "The
  ledger · your position") titles the band. Exact wording is a Designer/tone detail
  within DESIGN.md's Tone of voice rules, not a fixed string this plan mandates.
- **A3 — The distinction is achieved with existing tokens only.** No new token, color,
  spacing value, or component is introduced; if the Designer finds one genuinely
  needed, that is a spec change surfaced back before coding, not invented inline.
- **A4 — The closed and held states share the treatment.** Applying the same titling to
  both states (rather than only the held band) keeps the tab coherent; the "none"
  defensive fallback empty state is left unchanged (it is not one of the confusing
  bands).

## Open decisions

None — the approach is unambiguous within the design system; exact token selection is
delegated to the Designer stage below (not a blocker for planning).

**Owner steer (2026-07-19):** approved "Title + filled panel" — apply BOTH lever 1
(the "Your position" section kicker) AND lever 2 (the `bg-fill` surface swap). The
Designer stage should NOT treat the surface swap as an open yes/no; it is confirmed
in. Designer still picks exact tokens/wording within DESIGN.md vocabulary.

## ADR note

No ADR is added. This is a purely presentational refinement applying **existing**
DESIGN.md tokens and patterns (section kicker, `--fill` surface) to one shared
component — it makes no non-obvious architectural or design decision that reverses or
extends a prior ADR. ADR-18 (which relocated these stats into the Positions tab)
remains the governing decision; this plan only refines that band's visual treatment
within it. An ADR here would be overkill. If the Designer stage ends up selecting a
treatment that meaningfully reinterprets a reserved DESIGN.md pattern (it should not),
that would warrant re-opening this note.

## Notes for the Designer stage

This change **requires** the Designer stage after plan approval. Spec the following,
referencing only existing DESIGN.md tokens/components (Colors table, "Ruled stat band,"
"Headline score card" kicker, Tone of voice → "Kickers over labels"):

1. **The chosen distinction treatment for the in-tab position band:**
   - **Section kicker heading (required):** the eyebrow text (working: "Your position"),
     its token/size/weight/tracking/color — recommend reusing the exact kicker pattern
     already in `transactions-tab.tsx` for "Your transactions"
     (`text-[11px] font-semibold uppercase tracking-[0.14em]`, `--ink`) so it matches
     the existing in-file titling idiom.
   - **Surface treatment (recommended, decide yes/no):** whether the band moves from
     `bg-card` to `bg-fill` (the `--fill` surface-fill token) to read as a contained
     tinted panel, and whether the border/verticals (`border-border` / `border-line2`)
     stay or adjust to sit correctly on `--fill`. If not `bg-fill`, specify the
     alternative existing-vocabulary contained-panel cue.
   - Confirm **no** editorial double-rule and **no** new accent hue are used.

2. **Both states covered:** specify how the **held** state (populated stat band) and the
   **closed** state ("Position closed." caption + Realized P/L) both carry the same
   titled treatment so the tab reads as one coherent "your position" section. Do not
   change the "Position closed." wording or the `hasRealizedPL` gating rule (ADR-18 /
   PT-I1). The "none" defensive empty state is out of scope for the distinction.

3. **Confirm the page-header market grid stays as-is** — it is the reference; only the
   **tab** content changes. Both `/portfolio/[ticker]` and `/research/[symbol]` inherit
   the change through the single shared `TransactionsTab`, so record the spec once (in
   DESIGN.md item 6) and note it applies to both routes.
