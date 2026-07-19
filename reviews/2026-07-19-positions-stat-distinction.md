# Review: Positions tab — visually distinguish the in-tab stat band from the page-header market grid
Date: 2026-07-19
Status:

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 1 QUESTION
Requires owner decision: PSD-Q1 (manual visual acceptance only — not a code defect; does not block)
Ready for Coding agent: none

This is a clean, correctly-scoped presentational change. The realized-P/L /
panel-state gating (the one real risk in a "just restyling" edit) is byte-for-byte
unchanged; the diff touches only the two files the plan permits
(`components/research/transactions-tab.tsx` + `DESIGN.md`, plus plan/index
bookkeeping); token discipline holds (existing `bg-fill`/`--fill` + the verbatim
"Your transactions" kicker pattern, no hardcoded colors); and the Designer's
DESIGN.md item-6 update accurately describes the code and corrects a prior
4-col doc-drift from PT-I1. `npm run verify` is green (114/114). The only
residual is owner eyeball verification of the rendered result across both
routes/themes/states, which is inherently manual and is filed as PSD-Q1 (a
QUESTION, not an ISSUE), consistent with prior UI work on this project (PT-Q2,
NAV-Q1, FVL-Q1). No manufactured findings — this is a legitimate 0-ISSUE outcome.

## Findings

### PSD-Q1 — QUESTION
**File:** `components/research/transactions-tab.tsx:97-149`
**Problem:** Whether the rendered result actually reads as a distinct "your
position" panel — clearly separated from the page-header market grid above the
tab bar, in **both light and dark themes**, on **both** `/portfolio/[ticker]`
and `/research/[symbol]`, in **both** the held and closed states — is a visual
judgement that cannot be confirmed by static code review. Statically, the change
is sound: `bg-fill` (`#f3f0e9` light / `#252019` dark) reads as a subtle tinted
surface over the page `--background`, distinct from the header's `bg-card`;
`border-border` and the internal `border-line2` cell verticals are theme-aware
tokens defined in both `:root` and `.dark` (light `#e5e0d6`/`#eee9df`, dark
`#2e2921`/`#28231c`), so no border "disappears" in either theme — the low
`line2`-on-`fill` contrast is the intended hairline-rule aesthetic (DESIGN.md
notes `--line2` sits correctly on `--fill`, as it already does for Row hover).
The held-state grid's `-mx-7` exactly negates the panel's `px-7`, so cells align
to the panel edge and nothing clips outside the rounded border. No code reason
found that it would not render as specced.
**Recommendation:** Owner click-through of the four states (held + closed × both
routes) in light and dark, confirming (a) the in-tab band no longer reads as one
continuous band with the header grid, and (b) no visual regression to the header
grid itself. This is manual acceptance, not a code fix — no Coding agent action.

## Verification performed (Reviewer)

- **Scope containment (confirmed):** `git diff 05aab18e^..HEAD` for the
  stat-distinction feature touches only `components/research/transactions-tab.tsx`
  and `DESIGN.md` for source/spec (plus `plans/2026-07-19-positions-stat-distinction.md`,
  `plans/INDEX.md`, `STATUS.md` bookkeeping). Neither
  `app/(dashboard)/research/[symbol]/page.tsx` nor
  `app/(dashboard)/portfolio/[ticker]/page.tsx` (the reference header grids), nor
  `app/globals.css` / `tailwind.config.js` (tokens), was modified — grep for
  `page.tsx|globals.css|tailwind.config` across the feature range returns nothing.
- **Gating logic undisturbed (confirmed byte-for-byte):** `getPositionsPanelState`,
  `hasRealizedPL`, the `panelState` derivation (line 73), and
  `showRealizedPL = position != null && hasRealizedPL(position.realizedPL)`
  (line 81) are identical pre/post change. The `panelState === "closed"` /
  `"held"` / `"none"` branches render the same content, only re-wrapped in a
  `bg-fill` panel under the kicker. "Position closed." wording unchanged. The
  `"none"` empty state is untouched (still `bg-card`, "You do not hold", left
  as-is per plan A4). Realized P/L still shows/hides exactly on
  `hasRealizedPL(realizedPL)` (ADR-18/PT-I1) — not re-gated on quantity.
- **Token discipline (confirmed):** `--fill` is a defined token
  (`app/globals.css` light `#f3f0e9` / dark `#252019`, mapped to `fill: 'var(--fill)'`
  in `tailwind.config.js`). No hardcoded hex/oklch/rgb/hsl in the added lines.
  The "Your position" kicker classes
  (`text-[11px] font-semibold uppercase tracking-[0.14em]`) match the "Your
  transactions" kicker in the same file verbatim (lines 99, 116, 153).
- **DESIGN.md accuracy (confirmed):** item-6 now documents the titled `bg-fill`
  panel, both states, `border-border`/`border-line2` retained, "none" out of
  scope, and page-header grid unchanged — all matching the code. The prior
  drift is genuinely corrected: the pre-feature item 6 (parent of `4bcb9a97`)
  described a "bare (no card) 4-col ruled stat band" with no Realized P/L; it
  now correctly documents the 5th Realized P/L cell added in PT-I1 and the
  card-wrapped variant. No new drift introduced.
- **Security pass (Step 1):** No findings. The delta is a className/markup
  swap plus a static heading — no new user-input flow, no new fetch/query, no
  `dangerouslySetInnerHTML`/`eval`/template sink, no auth or data-exposure
  surface, no secrets. The existing `fetch`/`href` in the file are unchanged
  from the already-reviewed positions-tab code.
- **Test coverage:** No new tests, correctly. This is a pure presentational
  change (className swap + a static heading element) with **zero new logic** —
  the gating logic it re-wraps is unchanged and already covered by
  `lib/utils/positions-tab.test.ts` and
  `app/api/portfolio/positions/[ticker]/route.test.ts`. A snapshot/DOM test
  asserting a `bg-fill` className would be a hollow, low-value test, and no
  component-test harness exists in this repo. **Explicitly NOT flagged as an
  ISSUE** — adding a test here would be net-negative.
- **Verify block:** `npm run verify` green — typecheck ok, lint ok (only
  pre-existing warnings, none in the changed file), 114/114 tests, secret-scan
  clean. Confirms the Coding agent's report.
- **Standing checklist:** working tree clean (`git status --porcelain` empty);
  STATUS.md 11 lines, links-only, no narrative; index files conform to templates;
  no secrets; Verify block present and passing.

## Proposed DECISIONS.md entries

None. Per the plan's "ADR note," this is a purely presentational refinement
applying existing DESIGN.md tokens (section kicker, `--fill` surface) to one
shared component; it makes no non-obvious architectural or design decision.
ADR-18 remains the governing decision for the Positions tab. No new ADR warranted.
