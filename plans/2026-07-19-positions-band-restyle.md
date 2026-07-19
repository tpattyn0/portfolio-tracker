# Plan: Restyle the in-tab position band to match the other tabs' editorial ruled band (Intrinsic-tab treatment)
Date: 2026-07-19

## Problem

The immediately-prior refinement (`plans/2026-07-19-positions-stat-distinction.md`,
already implemented on this branch) distinguished the in-tab "Your position" stat band
from the page-header market grid by wrapping it in a **titled `bg-fill` contained
panel** — a "Your position" kicker over a `rounded-lg border border-border bg-fill`
card. The owner has looked at that result and does **not** want a special `bg-fill`
panel treatment. Instead the owner wants the position band styled **in the same style as
the section bands used by the other research-detail tabs** — specifically the **Intrinsic
value tab's** BEAR / BASE / BULL scenario band, which reads as a lighter, more editorial
"ruled section": a bare band bounded by a horizontal hairline rule, on the page/card
background, with **no card fill, no rounded box, no per-cell boxed verticals** — the
columns separated by generous whitespace and a single thin left-hairline divider.

Owner's words: *"no, do it in the same style as the headers for other tabs, like
intrinsic, … "* — i.e. make the position band **consistent with the other tabs**, not a
one-off tinted panel.

**Root cause of the mismatch to fix:** the position band currently uses the
card-wrapped ruled-stat-band variant plus a `bg-fill` tint (from the prior step),
whereas the Intrinsic tab (and the other headline-card tabs) render their multi-column
scenario band as a **bare, top-ruled editorial band** with no fill and no box.

### The reference — the Intrinsic tab's scenario band (read directly, cited)

`components/intrinsic-value.tsx:103-121` — the BEAR / BASE / BULL band, rendered as
`children` inside the `HeadlineScoreCard`:

```
<div className="grid grid-cols-3 border-t border-line pt-5">
  <div>
    <div className="text-[10.5px] uppercase tracking-[0.12em] text-dn">Bear</div>
    <div className="mt-1.5 font-serif text-[26px] text-mut">—</div>
    <div className="mt-0.5 text-[12px] text-mut">Single-point estimate</div>
  </div>
  <div className="border-l border-line2 pl-5">
    <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Base</div>
    <div className="mt-1.5 font-serif text-[26px]">{…}</div>
    <div className="mt-0.5 text-[12px] text-mut">Weighted estimate</div>
  </div>
  <div className="border-l border-line2 pl-5">
    <div className="text-[10.5px] uppercase tracking-[0.12em] text-up">Bull</div>
    <div className="mt-1.5 font-serif text-[26px] text-mut">—</div>
    <div className="mt-0.5 text-[12px] text-mut">Single-point estimate</div>
  </div>
</div>
```

The exact, load-bearing structural facts of the target style (this is what the position
band must adopt):

- **Wrapper:** `grid grid-cols-N border-t border-line pt-5` — a single **top** hairline
  rule (`border-t border-line`) and top padding (`pt-5`); **no `bg-*` fill, no
  `rounded-lg`, no outer `border border-border` box.** (DESIGN.md at line 798-799 also
  documents there is no bottom rule on the Intrinsic band itself; it is a section
  inside the card, separated from what's above it by the single top rule.)
- **Columns:** the **first** column has no left border and no left padding; **every
  column after the first** gets `border-l border-line2 pl-5` — a single thin hairline
  vertical + left padding acting as the divider. There are **no per-cell right borders**
  and no `px-7`/`-mx-7` bleed.
- **Cell kicker:** `text-[10.5px] uppercase tracking-[0.12em]`, **semantically colored**
  where the metric is signed/directional — but here (see "Kicker coloring" decision
  below) our metrics are neutral labels, so kickers stay `text-mut` (matching Intrinsic's
  Base column), **not** a fixed red/green like Bear/Bull.
- **Value:** `mt-1.5 font-serif text-[26px]`, colored `text-up`/`text-dn` when the value
  itself is signed (Unrealised P/L, Realized P/L) — exactly as the current band already
  colors them.
- **Sub-label (optional third line):** `mt-0.5 text-[12px] text-mut`.

This is DESIGN.md's **"Bare stat band"** vocabulary (DESIGN.md line 577: "no card
wrapper, just the ruled band") realized with a single top rule + left-hairline column
dividers — the same editorial ruled-section idiom the Intrinsic scenario band uses,
as opposed to the card-wrapped `bg-fill` panel variant the prior step introduced.

## Approach

Replace the prior step's `bg-fill` titled-panel treatment on the position band with the
**Intrinsic-tab bare ruled-band treatment**, so the position band reads as a consistent
editorial section like the other tabs — no card fill, no rounded box, no boxed per-cell
verticals.

Concretely, for the **held** and **closed** states in
`components/research/transactions-tab.tsx`:

1. **Drop the panel chrome.** Remove `rounded-lg border border-border bg-fill` and its
   `px-7`/`pt-[22px]`/`py-[22px]` panel padding, and remove the `-mx-7` negative-margin
   full-bleed hack that only existed to let cells reach the panel edge.

2. **Keep the "Your position" section kicker**, but promote it to the band's own top
   rule so it reads like the other tabs' section headers. The kicker text and typography
   are unchanged (`text-[11px] font-semibold uppercase tracking-[0.14em]`, default
   `--ink`). Place it immediately above the band; the band's `border-t border-line` +
   `pt-5` provides the editorial hairline separation. (See "Kicker" decision — the
   Intrinsic band does not have its own separate kicker because it lives *inside* a
   HeadlineScoreCard whose card header already titles it; our position band is standalone
   in the tab, so it keeps a lightweight section kicker as its title. This matches the
   "Your transactions" card kicker already in this same file and gives the band a header
   consistent with the tabs' section-header idiom.)

3. **Restyle the held-state stat band** to the Intrinsic grid shape:
   `grid grid-cols-4|5 border-t border-line pt-5`, first cell bare, cells 2..N get
   `border-l border-line2 pl-5`. Cell kickers stay `text-[10.5px] uppercase
   tracking-[0.12em] text-mut`; values stay `mt-1.5 font-serif text-[26px]` (signed cells
   keep `text-up`/`text-dn`). The Unrealised P/L percent sub-line stays as a
   `mt-0.5 text-[12px]` line (currently `mt-0.5 text-[12px]` colored — keep its signed
   color; it is the analog of Intrinsic's sub-label line).

4. **Restyle the closed-state block** to the same bare, top-ruled treatment: the "Your
   position" kicker above a `border-t border-line pt-5` block containing the italic
   "Position closed." caption and (gated, unchanged) the Realized P/L line. No card fill,
   no rounded box.

5. **Update DESIGN.md item 6** (the Positions tab spec) to describe this Intrinsic-
   matching bare ruled-band treatment, **superseding** the prior step's `bg-fill` panel
   spec (currently DESIGN.md lines ~804-912). We are skipping a separate Designer stage
   per the owner's explicit instruction — this plan carries the full spec, and the
   DESIGN.md rewrite is a Coding-agent task in this plan.

The **page-header market grid** on both route pages
(`app/(dashboard)/research/[symbol]/page.tsx` ~line 177,
`app/(dashboard)/portfolio/[ticker]/page.tsx`) is **not touched** — it keeps its
card-wrapped `bg-card` grid. The whole point of the owner's ask is that the in-tab band
now matches the *other tabs* (Intrinsic etc.), which are themselves visually distinct
from that card-wrapped header grid; the distinction from the header is preserved,
achieved now by the editorial bare-band idiom rather than a `bg-fill` tint.

### Preserved exactly (do NOT change)

- `getPositionsPanelState(position)` three-way `"held"`/`"closed"`/`"none"` gating and
  the `quantity > 0` rule (ADR-18).
- `hasRealizedPL(position.realizedPL)` gating for the Realized P/L cell/line in both
  held and closed states (ADR-18 / PT-I1 — Realized P/L is **not** re-gated on quantity).
- The "Position closed." wording.
- The "none" defensive empty state (quiet card, "You do not hold {symbol}." + "+ Add to
  portfolio" pill) — **unchanged**, it is not one of the confusing bands and keeps its
  existing card treatment.
- The "Your transactions" card below the band — unchanged (it is already `bg-card` and
  is not part of this restyle).
- All data, values, currency formatting, and the signed `text-up`/`text-dn` coloring.

### Decisions folded into this plan (no Designer stage)

- **Kicker coloring — kickers stay `text-mut`, not semantic red/green.** Intrinsic's
  Bear/Bull kickers are `text-dn`/`text-up` because Bear/Bull *are* directional
  scenarios; Base is `text-mut`. Our columns (Shares held / Average cost / Market value
  / Unrealised P/L / Realized P/L) are **neutral metric labels**, not directional
  scenarios, so all kickers stay `text-mut` (like Intrinsic's Base). The *values* remain
  signed-colored (Unrealised/Realized P/L in `text-up`/`text-dn`) exactly as today. This
  matches how the page-header market grid and the Ruled stat band elsewhere color
  neutral kickers.
- **Keep the "Your position" section kicker.** The Intrinsic band has no separate kicker
  only because its enclosing HeadlineScoreCard header already titles it; our band is
  standalone, so a lightweight section kicker is the equivalent section header and keeps
  the band consistent with the tab-section idiom (and with the sibling "Your
  transactions" kicker in the same file). Text and type unchanged from the prior step.
- **Column left-padding value:** use `pl-5` (Intrinsic's exact value) for cells 2..N,
  replacing the prior `px-7` per-cell padding. `pt-5` for the band's top padding
  (Intrinsic's value). These are existing DESIGN.md/Intrinsic spacing values, not new
  tokens.
- **Border tokens:** top rule `border-t border-line`; column dividers `border-l
  border-line2` — both exactly as Intrinsic uses. No `border-border`, no `bg-fill`, no
  `rounded-lg` on the band.

### Explicitly rejected

- Keeping any `bg-fill`/`bg-card` fill or `rounded-lg`/`border border-border` box on the
  band — that is the prior-step treatment the owner rejected.
- Wrapping the position band in a HeadlineScoreCard — overkill; the band is a section,
  not a scored headline, and the Intrinsic *band* itself is just the ruled grid, not the
  whole card.
- Any new token, color, spacing, or component — this is pure alignment to the existing
  Intrinsic/Bare-stat-band vocabulary.

## Tasks

1. [ ] **Restyle the held-state position band to the Intrinsic bare ruled band** in
   `components/research/transactions-tab.tsx` (the `panelState === "held"` block,
   currently lines ~114-149). Replace the `rounded-lg border border-border bg-fill px-7
   pt-[22px]` wrapper and the `-mx-7 grid … px-7 pb-[22px]`/`border-r border-line2` cell
   pattern with: an outer `<div>` holding the "Your position" kicker
   (`text-[11px] font-semibold uppercase tracking-[0.14em]`, unchanged) directly above a
   `grid grid-cols-4|5 border-t border-line pt-5` band; the **first** cell bare (no left
   border/padding), **cells 2..N** get `border-l border-line2 pl-5`. Cell kickers stay
   `text-[10.5px] uppercase tracking-[0.12em] text-mut`; values stay `mt-1.5 font-serif
   text-[26px]` with `text-up`/`text-dn` on the two signed cells; the Unrealised P/L
   percent stays a `mt-0.5 text-[12px]` signed sub-line. The 4-vs-5 column count still
   keys off `showRealizedPL` exactly as today; the Realized P/L cell is the 5th column
   and is the **last** cell (gets `border-l border-line2 pl-5` like the others). Give the
   kicker the same `mb-4` bottom gap it has today (or reuse Intrinsic-consistent spacing)
   — do not invent a new gap.
   — Acceptance: with a held position, the Positions tab renders a **bare, top-ruled**
   position band (no card fill, no rounded box, no per-cell right borders), visually in
   the same editorial style as the Intrinsic tab's BEAR/BASE/BULL band; all five metric
   values and signed coloring are unchanged; no hardcoded hex/oklch or off-token spacing;
   `npm run verify` passes.

2. [ ] **Restyle the closed-state block to the same bare treatment** (the
   `panelState === "closed"` block, currently lines ~97-112). Replace the `rounded-lg
   border border-border bg-fill px-7 py-[22px]` wrapper with an outer `<div>` holding the
   "Your position" kicker above a `border-t border-line pt-5` block containing the italic
   "Position closed." caption (`font-serif text-[14.5px] italic text-mut`, unchanged) and
   — gated on `showRealizedPL`, wording/gating unchanged — the Realized P/L line
   (`text-mut` label + `text-up`/`text-dn` value). No card fill, no rounded box.
   — Acceptance: a fully-sold (closed) position shows the same bare, top-ruled "Your
   position" section (kicker + hairline rule) above the "Position closed." caption and,
   when `hasRealizedPL` is true, the Realized P/L line; Realized-P/L visibility is
   byte-for-byte the same rule as before (`hasRealizedPL(position.realizedPL)`,
   **not** re-gated on `quantity`); `npm run verify` passes.

3. [ ] **Leave the "none" empty state and the "Your transactions" card unchanged.**
   Confirm the `panelState === "none"` block and the transactions card below the band are
   not modified by Tasks 1-2.
   — Acceptance: `git diff` shows no change to the `panelState === "none"` block or the
   "Your transactions" `bg-card` card; the "You do not hold {symbol}." wording and the
   "+ Add to portfolio" / "+ Add transaction" pills are untouched.

4. [ ] **Update DESIGN.md item 6 (Positions tab) to describe the new Intrinsic-matching
   bare ruled-band treatment, superseding the prior `bg-fill` panel spec.** Rewrite the
   "Your position panel" spec (currently DESIGN.md ~lines 806-912) so it documents: the
   band now uses the **bare, top-ruled editorial band** treatment (the same idiom as the
   Intrinsic tab's scenario band — cross-reference item 5 and Components → "Bare stat
   band"): `border-t border-line` top rule, `border-l border-line2 pl-5` column
   dividers, **no `bg-fill`, no card box**; the "Your position" section kicker is kept as
   the band's section header; the held and closed states share this treatment; the "none"
   state and the page-header market grid are unchanged. Explicitly note this **supersedes**
   `plans/2026-07-19-positions-stat-distinction.md`'s `bg-fill` titled-panel treatment
   (owner reversed it 2026-07-19 in favour of consistency with the other tabs). Remove
   the now-obsolete `bg-fill`/surface-swap prose from item 6. Do not introduce any new
   token.
   — Acceptance: DESIGN.md item 6 describes the bare ruled-band treatment referencing
   only existing tokens (`--line`, `--line2`, `--mut`, `--up`/`--dn`, `font-serif`), notes
   it supersedes the `bg-fill` panel spec, and states the page-header grid and "none"
   state are unchanged; no new token/color/spacing appears; `npm run verify` passes.

5. [ ] **Confirm both routes and the untouched header grid.** Verify the restyle renders
   identically on `/research/[symbol]` and `/portfolio/[ticker]` (both consume the one
   shared `TransactionsTab`) and that neither route page's header market grid changed.
   — Acceptance: manual check on both routes (see Verification) shows the bare,
   Intrinsic-style position band; `git diff` touches only
   `components/research/transactions-tab.tsx` and `DESIGN.md` — and does **not** touch the
   `grid grid-cols-4 … bg-card` header block in either route page.

## Files to create or modify

- `components/research/transactions-tab.tsx` — restyle the held- and closed-state
  position blocks from the `bg-fill` panel to the Intrinsic bare ruled band (Tasks 1-2);
  leave the "none" state and the "Your transactions" card unchanged (Task 3). Only source
  file changed.
- `DESIGN.md` — rewrite item 6's "Your position" spec to the bare ruled-band treatment,
  superseding the prior `bg-fill` panel spec (Task 4).
- No route-page files change: `app/(dashboard)/research/[symbol]/page.tsx` and
  `app/(dashboard)/portfolio/[ticker]/page.tsx` headers are the reference and stay as-is.

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically — typecheck,
lint, tests, secret-scan. Beyond it, manual UI checks (both light and dark theme):

- `/portfolio/[ticker]` for a **currently held** ticker → Positions tab. The position
  band must read as a **bare, top-ruled editorial band** (single top hairline rule,
  thin left-hairline column dividers, generous whitespace) in the **same style as the
  Intrinsic value tab's** BEAR/BASE/BULL band — **no** card fill, **no** rounded box,
  **no** boxed per-cell verticals. Compare side by side with the Intrinsic tab: the two
  bands should read as the same idiom.
- `/research/[symbol]` for the same held ticker → identical band (shared component).
- A **fully-sold (closed) position** (`quantity === 0`, transactions on file) → the
  "Your position" section header + hairline rule above the "Position closed." caption and
  the Realized P/L line; Realized P/L still appears exactly when it did before.
- The **page-header market grid** above the tab bar is visually unchanged on both routes
  and still reads as the card-wrapped `bg-card` band (the reference).
- Confirm the "none" defensive empty state ("You do not hold {symbol}.") is visually
  unchanged.

## Assumptions

- **A1 — Keep the "Your position" section kicker.** The Intrinsic band omits a per-band
  kicker only because its HeadlineScoreCard header titles it; the standalone position
  band keeps its lightweight "Your position" kicker as the equivalent section header,
  consistent with the sibling "Your transactions" kicker in the same file. If the owner
  prefers no kicker at all, dropping it is a one-line follow-up — but keeping it is the
  more consistent read and matches the tab-section idiom. (Non-material to the band's
  bare-ruled treatment, which is the substance of the owner's ask.)
- **A2 — Column divider is the single `border-l border-line2 pl-5` hairline** exactly as
  the Intrinsic band does it (a thin vertical rule + whitespace), not "whitespace only /
  no rule." The reference band uses the hairline, so we replicate the reference rather
  than guess a rule-less variant.
- **A3 — Spacing values `pt-5` / `pl-5` are taken verbatim from the Intrinsic band** and
  the kicker keeps its existing bottom gap; no new spacing token is introduced. If the
  Intrinsic band's exact `mt-1.5`/`mt-0.5` intra-cell spacing differs trivially from the
  position band's current `mt-1.5`, prefer the Intrinsic values for consistency.
- **A4 — The held and closed states share the treatment** (both bare, top-ruled, under
  the same "Your position" kicker); the "none" state is out of scope and unchanged.

## Open decisions

None — the reference (the Intrinsic tab's band) is concrete and read directly from the
code, and the owner instructed the Planner to hand the plan straight to the Coding agent
without a confirmation round. Any residual choices are captured under Assumptions.

## Supersession note

This plan **supersedes the visual treatment** introduced by
`plans/2026-07-19-positions-stat-distinction.md` (the `bg-fill` titled-panel band). That
plan and its ADR-free refinement stand as history; this plan reverses only its *surface
treatment* (bg-fill panel → bare Intrinsic-style ruled band) at the owner's request. The
gating logic, data, and Realized-P/L semantics from ADR-18 / PT-I1 are untouched. No new
ADR is warranted: this is a presentational alignment to an existing DESIGN.md pattern
(the Intrinsic scenario band / "Bare stat band"), making no non-obvious architectural or
design decision. ADR-18 remains the governing decision for the Positions tab.
