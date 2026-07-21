# Review: Collapsible style-preset picker (scoring-weights settings UX)
Date: 2026-07-21
Status: IMPLEMENTED — 2026-07-21 (SUG-1 applied: chevron aria-hidden)

## Summary
Findings: [0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 0 QUESTIONs]
Requires owner decision: none
Ready for Coding agent: SUG-1 (optional polish)

Reviewed the isolated iteration-1 diff of `feature/scoring-picker-ux` against its
PR base `feature/scoring-style-descriptions-retune`
(`git diff feature/scoring-style-descriptions-retune...HEAD`) — i.e. only what
PR #26 adds on top of the already-reviewed preset (#24) and retune (#25) work.
The change is layout/disclosure-only: it wraps the "Start from a style" preset
picker in a native `<details>/<summary>` collapse (closed by default) inside the
shared `ScoringWeightsSection`, updates `loading.tsx`'s skeleton to a collapsed
trigger-row, adds ADR-25, and carries the plan / DESIGN.md / AGENT.md / INDEX /
STATUS doc updates. Eight files touched, none of them scoring/API/DB code.

Verdict: correct, in-scope, and safe. All the load-bearing invariants
(collapsed-by-default, populate-only preserved, ADR-23/24 intact, skeleton
parity, no out-of-scope edits) hold. One optional a11y hardening suggestion only.

### Method notes
- **Security pass:** the `security-review` skill diffs the working tree against
  HEAD; the working tree is clean (branch HEAD == tree), so it has no input for
  this already-committed branch. Skipped per the Reviewer protocol for
  already-committed/merged-style reviews; security pass done manually against the
  isolated `...HEAD` range instead. The diff adds no network calls, no auth
  surface, no data mutation, no secret-shaped strings, and no user-input handling
  (the only interactivity is a native disclosure toggle and the pre-existing
  populate-only row buttons). Nothing security-relevant. Verify secret-scan:
  `no leaks found`.
- **Verify block:** `npm run verify` green — typecheck ok · lint ok (pre-existing
  warnings only, no new errors) · 254/254 tests · secret-scan `no leaks found`.
- **Working tree:** `git status --porcelain` empty at review time; branch HEAD is
  `52128394`, up to date with `origin/feature/scoring-picker-ux`. No BLOCKER.
- The Coding agent's live Playwright verification (`scratch/verify-collapsible-picker.mjs`,
  gitignored, not tracked) is recorded in ADR-25 evidence; per the task brief I
  relied on reading the code + diff for correctness rather than re-driving the
  browser, with extra scrutiny on the `<details>`/`<summary>` structure.

## Findings

### SUG-1 — Decorative chevron is not explicitly `aria-hidden`
**File:** app/(dashboard)/settings/page.tsx:232
**Problem:** The `<ChevronDown>` inside `<summary>` is purely decorative (its
rotation mirrors the disclosure's open state, which `<details>`/`<summary>`
already exposes natively to assistive tech). `lucide-react` renders a bare
`<svg>` with no `role`/`aria-label` and no accessible text, so in practice it
does **not** currently pollute the summary's accessible name — that name is
correctly taken from the visible text span ("Start from a style — prefill
weights from a named investing style"). So this is not a defect today. However,
the icon is not explicitly marked `aria-hidden="true"`, which is the
belt-and-suspenders convention for decorative iconography and guards against a
future lucide/SVG change (or a screen reader that surfaces the empty `<svg>`)
altering the trigger's accessible name.
**Recommendation:** Add `aria-hidden="true"` (and optionally `focusable="false"`)
to the `<ChevronDown>` on `page.tsx:232`, and to the corresponding
`h-4 w-4` chevron-footprint `SkeletonBlock` in `loading.tsx` if desired for
symmetry. Purely additive, no behavior change. Optional polish — not a blocker to
merge.

## Verification of the task's six focus areas

(a) **Collapsed-by-default disclosure — CORRECT.** `<details className="group mb-5">`
with **no `open` / `defaultOpen` attribute** (`page.tsx:225`; grep for
`<details ... open` / `defaultOpen` returns nothing). `<details>` renders closed
when `open` is absent, on every fresh render/navigation (state is not persisted).
Implemented once in the shared `ScoringWeightsSection`, so it applies to both the
Composite (`fields={COMPOSITE_FIELDS}`) and Fundamental (`fields={FUNDAMENTAL_FIELDS}`)
instances. Collapsed-by-default is real, not accidentally open.

(b) **Populate-only preserved / ADR-23/24 intact — CORRECT.** The option-row
`<button>`s (`page.tsx:235-245`) are unchanged from the base branch except for
being moved into the `<details>` **body** (the `<div className="mt-2 rounded-md
border...">`, not the `<summary>`). Each row still calls
`setInputs(toInputs(preset[group]! as Record<K, number>))` on click — no PUT, no
`useMutation`, no fetch introduced (grep of `+` lines for network calls returns
nothing). No active/selected-row highlight class added — the row `className` is
byte-identical to the base (hover `--fill`, focus-visible inset ring). Because a
`<summary>` toggles the disclosure only from itself and the rows live in the
body, a row click applies the preset **without** closing the picker — the
stays-open invariant holds structurally, no extra wiring. `scoring-weights.ts`,
`scoring-preferences.service.ts`, and the settings API route are untouched
(confirmed: empty diff), so ADR-23's populate-only mechanism and ADR-24's preset
values / blurbs are provably unchanged.

(c) **A11y — CORRECT (native), with SUG-1 as optional hardening.** The
`<summary>` is natively Tab-reachable, toggles on Enter/Space, and exposes
expanded/collapsed state to assistive tech for free. The default disclosure
marker is suppressed via `list-none` + `[&::-webkit-details-marker]:hidden`
(`page.tsx:227`) without touching the accessible name (which comes from the
visible text span). The chevron rotation is decorative and driven by the
`group` + `group-open:rotate-180` Tailwind pattern — non-semantic (see SUG-1 re:
explicit `aria-hidden`). The option rows retain their `<button type="button">`
semantics and `focus-visible:ring-inset` treatment. `<summary>` itself also
carries the same focus-visible ring, so the trigger has a visible focus state.

(d) **Skeleton parity — CORRECT.** `loading.tsx` (`:41-44`) replaces the old
3-row expanded-list stack with a single compact trigger row: a kicker-variant
`SkeletonText` + an `h-4 w-4` chevron-footprint `SkeletonBlock`, in a
`flex items-center justify-between py-1` container that mirrors the live
`<summary>`'s layout. No bordered option list is rendered. This matches the
collapsed first paint, so there is no tall→short flash on hydration. The doc
comment above the skeleton was updated to explain the rationale and cite ADR-25.

(e) **No out-of-scope changes — CONFIRMED.** The `page.tsx` diff is 18 changed
lines, all within the preset-picker block. `COMPOSITE_FIELDS`/`FUNDAMENTAL_FIELDS`
(`page.tsx:39,47`) are not in the diff — Task 3 (input order) is unchanged
(owner chose Option A / OD-1). The status line (`Total: X%`), the Reset/Save
actions row, and the `sumsTo100`/Save gate are not in the `+`/`-` diff (the one
`Total:` grep hit is unchanged context) — Task 2 confirmed no-move by the
Designer. Preset VALUES, blurbs, `scoring-weights.ts`, the API route, and the
gate module (`scoring-weights-settings-gate.ts`) are all untouched (empty diff).
The option rows are not restyled beyond the disclosure wrapper.

(f) **ADR-25 — CORRECT.** Present in `DECISIONS.md`, Status flipped
`proposed → accepted (implemented 2026-07-21)` with concrete file:line evidence
(`page.tsx:225-247`, `page.tsx:232` chevron, `page.tsx:235-245` rows,
`loading.tsx:41-44` skeleton, DESIGN.md refs). It accurately describes the
collapse decision, the no-`open` closed-by-default property, the
`group-open:rotate-180` chevron wiring, the rows-in-body / stays-open invariant,
and explicitly states ADR-23/24 are preserved (the collapse hides the list
rather than adding selection state). The mirrored AGENT.md fragile-surface entry
for ADR-25 is also present and consistent.

### Standing checklist
- Working tree clean — PASS (`git status --porcelain` empty).
- STATUS.md within limits — PASS (13 lines, links only, no custom sections; the
  committed in-flight entry points to the plan/branch/PR, no narrative).
- Files conform to templates — PASS (ADR-25 matches the ADR format; plan and
  INDEX rows conform; INDEX row for this plan is `in review`, correct pre-review).
- Secrets — PASS (no secret-shaped strings in diff; `.env`/`scratch/` gitignored;
  the `scratch/verify-*.mjs` probe is gitignored and not tracked; secret-scan
  `no leaks found`).
- Verify block present and runnable — PASS (`npm run verify` green, 254/254).
- Test coverage — no new/modified functions or routes; the disclosure is a
  presentational wrapper over untouched, already-tested pure logic
  (`scoring-weights-settings-gate.ts`), and this repo has no
  `@testing-library/react` seam for component-interaction tests (documented,
  AGENT.md/ADR-22). No missing-test ISSUE — consistent with the plan's stated
  test posture (Assumption 3) and verified live via Playwright by the Coding
  agent. Not flagged.

## Proposed DECISIONS.md entries
None — ADR-25 is already present, correctly finalized as `accepted` with
evidence. No new ADR needed.
