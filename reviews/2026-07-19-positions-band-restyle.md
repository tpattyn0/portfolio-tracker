# Review: positions-band-restyle
Date: 2026-07-19
Status: IMPLEMENTED — 2026-07-19

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 1 QUESTION
Requires owner decision: PBR-Q1 (owner visual acceptance only — manual, non-blocking; does not gate the Coding agent)
Ready for Coding agent: none

Clean, tightly-scoped presentational change. The in-tab "Your position" band (held
and closed states) is restyled from the prior `bg-fill` titled panel to the bare,
top-ruled editorial band matching the Intrinsic value tab. All gating/logic is
byte-for-byte unchanged, the restyle matches the Intrinsic reference verbatim, scope
is fully contained to `components/research/transactions-tab.tsx` + `DESIGN.md` + the
plan, only existing tokens are used, and `npm run verify` is green (114/114). No
code findings — the sole residual is owner eyeball acceptance of the visual result,
framed as a QUESTION consistent with prior UI work on this project.

Review target: branch HEAD `43fb2441` (delta commit) on `feature/positions-tab`; the
`331dd767` STATUS.md commit is on top. Working tree clean (`git status --porcelain`
empty). Scope isolated against `efd47ab2` (the prior IMPLEMENTED stat-distinction);
the only source/spec changes since are the three in-scope files.

## Findings

### PBR-Q1 — QUESTION
**File:** `components/research/transactions-tab.tsx:97-149` (both routes, both themes)
**Problem:** Whether the bare, top-ruled band now *visually* reads as matching the
Intrinsic value tab's BEAR/BASE/BULL band — across both themes (light/dark), both
routes (`/research/[symbol]`, `/portfolio/[ticker]`), and both the held and closed
states — is inherently owner-eyeball acceptance, not statically verifiable. The code
review found no concrete reason it would render off-spec: the markup uses the exact
Intrinsic idiom (`grid border-t border-line pt-5` wrapper, first cell bare, cells
2..N `border-l border-line2 pl-5`, no fill/rounded box/per-cell right borders), and
the shared `TransactionsTab` guarantees pixel-identical rendering on both routes.
**Recommendation:** Owner does a manual click-through of the held and closed states
on both routes in both themes, confirming the band reads as the same editorial idiom
as the Intrinsic tab. This is acceptance only — no code change is expected, and it
does not block stamping the review IMPLEMENTED or the Coding agent proceeding.

## Verification performed

- **Gating/logic preserved (the one real restyle risk):** confirmed byte-for-byte.
  `getPositionsPanelState` (`quantity > 0`) and `hasRealizedPL(position.realizedPL)`
  are unchanged (`transactions-tab.tsx:73,81`). The diff (`git show 43fb2441 --
  components/research/transactions-tab.tsx`) touches *only* wrapper/cell `className`
  strings — the `panelState === "held"/"closed"/"none"` conditionals, the
  `showRealizedPL` guard, the `position.unrealizedPL >= 0 ? text-up : text-dn` signed
  coloring, and all `formatCurrency`/`formatNumber`/`formatPercent` calls are
  identical. Realized P/L is still gated on `hasRealizedPL` only, NOT re-gated on
  quantity (ADR-18/PT-I1 preserved). "Position closed." wording unchanged (`:101`).
  `positions-tab.test.ts`'s gating tests pass unmodified.
- **Matches the Intrinsic reference:** compared against `components/intrinsic-value.tsx:103-121`.
  Both use `grid border-t border-line pt-5`, first cell bare `<div>`, subsequent
  cells `border-l border-line2 pl-5`, no `bg-fill`/`rounded`/outer border box, no
  per-cell right borders. The 5th (Realized P/L) cell correctly gets
  `border-l border-line2 pl-5` (`:140`), same divider as cells 2-4. Kickers are
  `text-mut`; signed values keep `text-up`/`text-dn`.
- **No leftover chrome:** `grep -nE 'bg-fill|rounded-lg|border-border|-mx-7|px-7|border-r'`
  on the file returns only lines 86 (the "none" empty-state card) and 151 (the "Your
  transactions" card) — both legitimately out of scope and expected to retain card
  chrome. The held/closed band has no residual `-mx-7`/`px-7`/`bg-fill`/`rounded-lg`/
  `border-border`/`border-r`.
- **Scope containment:** `git diff --stat efd47ab2 HEAD` = DESIGN.md, STATUS.md,
  transactions-tab.tsx, the new plan, plans/INDEX.md. Neither route page's header
  market grid changed (`git diff efd47ab2 HEAD -- app/(dashboard)/portfolio/[ticker]/page.tsx
  app/(dashboard)/research/[symbol]/page.tsx` is empty). The "none" block and "Your
  transactions" card are untouched.
- **Token discipline:** only pre-existing tokens — `border-line`, `border-line2`,
  `text-mut`, `text-up`/`text-dn`, `font-serif`, and the `pt-5`/`pl-5` spacing lifted
  verbatim from the Intrinsic band. No hardcoded hex/oklch, no new arbitrary spacing.
- **DESIGN.md item 6 accuracy:** rewrite describes the bare ruled-band treatment
  matching the code, removes the obsolete `bg-fill` panel prose, explicitly states it
  **supersedes** `plans/2026-07-19-positions-stat-distinction.md`, documents the
  page-header grid and "none" state as unchanged, and introduces no new token/color/
  spacing. DESIGN.md is internally consistent; the superseded stat-distinction plan
  remaining `implemented` in the index is fine as history.
- **Test coverage:** no new tests added, and correctly so. This is a pure
  presentational className change with zero new logic; the existing
  `positions-tab.test.ts` (9 gating tests) + `route.test.ts` still cover the untouched
  gating/realized-P/L logic, and their passing unmodified is direct evidence the
  gating is intact. No component-test harness exists in this repo (per PT-S2), and a
  className-assertion test would be hollow and low-value. Not flagging "no test for a
  CSS restyle" as an ISSUE — it would be noise here.
- **Standing checklist:** working tree clean; STATUS.md 12 lines, links-only, no
  narrative/custom sections (the `## Blocked` TD-01 entry is the accepted-per-ADR-7
  production-only item, not a review blocker); INDEX files and ADR/TECH_DEBT formats
  conform; no secrets (`gitleaks` clean); `## Verify` block present and green —
  `npm run verify`: typecheck ok, lint ok, 114/114 tests, secret-scan clean.
- **Security pass:** ran the `security-review` skill and did an independent pass. The
  delta touches only React JSX classNames and Markdown — no new user input, queries,
  routes, auth paths, `dangerouslySetInnerHTML`, or secrets. All rendered values go
  through React auto-escaping + existing formatters. 0 security findings.

## Proposed DECISIONS.md entries
None — this is a presentational refinement fully covered by the existing ADR-18
(Positions tab) and ADR-8 (Meridian token system). No new architectural decision was
made; the DESIGN.md item 6 rewrite documents the superseding of the stat-distinction
plan's `bg-fill` treatment, which is a Designer-spec change, not an ADR.
