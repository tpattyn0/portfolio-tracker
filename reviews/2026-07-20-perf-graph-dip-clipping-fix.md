# Review: perf-graph dip clipping fix — margined drawing domain
Date: 2026-07-20
Status: IMPLEMENTED — 2026-07-20

## Summary
Findings: [0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 1 QUESTION]
Requires owner decision: DIP-Q1 (visual click-through acceptance — no Playwright run)
Ready for Coding agent: DIP-S1 (optional)

Scope reviewed: the dip-clipping delta only (commit `7a43a716`) —
`lib/utils/chart-path.ts` (+ `.test.ts`), `components/portfolio-chart.tsx`,
`components/research/detail-price-chart.tsx`, `AGENT.md`, `plans/INDEX.md`.
Prior IMPLEMENTED work on this branch (PR #19) was not re-reviewed. Working tree
clean; branch HEAD reviewed. Verify block green: typecheck ok · lint ok
(pre-existing warnings only, none in the delta) · 141/141 tests · secret-scan
clean. This matches the coding agent's reported 141/141.

The two real-risk spots called out for this review were verified STATICALLY and
by re-running the test's own bezier sampler — both are correct:

**(A) Bezier-overshoot geometry & test faithfulness — verified.**
`lib/utils/chart-path.test.ts:140-242` samples the *actual cubic-bezier curve*
(`sampleBezierYExtent`, 200 samples per segment, re-deriving the exact control
points `buildPath` uses), not just the vertices — so it genuinely guards the
overshoot *between* vertices, which is the whole bug. The regression guard
(`domainMargin = 0` → curve maxY > `height - padding`) and the fix assertion
(`CHART_DOMAIN_MARGIN` → whole curve within `[padding, height - padding]`) are
both real and pass. I reproduced the sampler independently: the test series
`[100,98,95,90,40,200]` (h=220, pad=8) overshoots to y≈216.47 at margin=0
(4.47px below the 212 floor — a faithful reproduction, comparable steepness to
the plan's 219.64 probe), and at `CHART_DOMAIN_MARGIN=0.08` lands at maxY≈201.78
/ minY≈22.07 — comfortably inside with ~10px of safety at the floor. A
deliberately steeper case `[100,100,100,100,20,300]` still stays inside at 0.08
(maxY≈202.18), so the margin has a large safety factor; even much steeper
dip-then-spike shapes than the tested worst case remain within the plot. Margin
is sufficient.

**Backward-compat — verified.** `marginDomain(min,max,0)` returns `{domainMin:
min, domainMax: max}` exactly (`chart-path.ts:47-49`), and a flat series
(`range === 0`) also returns `[min,max]` unchanged (no div-by-zero — the
`|| 1` guard in `buildPath` stands). The pre-existing `buildPath`/`gridlineYs`
tests are unchanged and still pass; `domainMargin` defaults to `0`, so the old
behaviour is byte-identical for existing callers.

**(B) Domain-registration invariant — verified in both components.** In
`portfolio-chart.tsx` (line 155) and `detail-price-chart.tsx` (line 75) there is
exactly ONE `marginDomain(min, max, CHART_DOMAIN_MARGIN)` call per component,
whose `{domainMin, domainMax}` output feeds BOTH `buildPath`
(`portfolio-chart.tsx:157`, `detail-price-chart.tsx:78` pass
`CHART_DOMAIN_MARGIN`; `buildPath` recomputes the identical margined domain
internally via the same helper) AND `gridlineYs` (`portfolio-chart.tsx:164`,
`detail-price-chart.tsx:87` pass `domainMin`/`domainMax`). Single source of
truth — line and gridlines cannot drift apart. The prior fix's invariant is
preserved, not re-opened.

**Labels stay on TRUE min/max — verified.** `yTicks = niceYTicks(yMin, yMax, 3)`
in `portfolio-chart.tsx:148` and `niceYTicks(min, max, 3)` in
`detail-price-chart.tsx:68` both read the RAW, un-margined min/max. Only the
pixel mapping uses the margined domain. No displayed number changes.

**Hover marker — verified, TD-33 correctly scoped out.** Both charts' hover
`yFrac` denominator now uses the margined range (`portfolio-chart.tsx:172-173`,
`detail-price-chart.tsx:131-133`), keeping the marker registered with the line's
domain scaling. This change does NOT touch the pre-existing padding-omission gap
tracked as TD-33 (the hover/reference-line `y` is still `yFrac * height` with no
`padding` term, vs `buildPath`'s `padding + yFrac*(height-2*padding)`). I
confirmed against `TECH_DEBT.md:31`: TD-33 is Low/cosmetic (~3.6% off near plot
edges), pre-existing, and unchanged in scope by this fix. It is neither
introduced nor materially worsened — switching the denominator to the shared
margined domain makes the marker *more* aligned to the line, not less. The
AGENT.md note (line 43) documents this accurately.

**(C) Reference line (detail chart) — verified.** The clamp stays on the TRUE
`[min, max]` (`detail-price-chart.tsx:172`, `Math.max(min, Math.min(max,
ref.value))`) while the `yFrac` denominator uses the margined `valueRange`
(line 131/173). A reference line at the true min therefore lands exactly where
`buildPath` now plots the series' min vertex — consistent, no misplacement. The
inline comment (lines 163-171) explains this correctly.

**Scope — verified.** The delta touches only the five intended files (+ plan and
INDEX). No performance route, service, or data-series file is in the diff — the
(correct) spike is untouched. No `hsl(var())` reintroduced (the only match is
the existing AGENT.md prose warning against it). Flat/degenerate series handled
(margin zero → unchanged, no div-by-zero).

**Security pass (Step 1) — 0 findings.** The delta is purely presentational SVG
chart geometry: no user-input handling, no auth/session logic, no DB access, no
injection surface, no `dangerouslySetInnerHTML`/`eval`/`innerHTML`, no secrets,
no new `fetch` (the two pre-existing `fetch` calls hit already-authenticated
routes and were not modified). No new attack surface is introduced.

**Doc drift / test coverage (Step 3) — clean.** The new `marginDomain` function
has dedicated tests (`chart-path.test.ts:123-138`: margin-0 no-op, flat-series
no-op, symmetric expansion). `buildPath`'s new `domainMargin` path is covered by
the dip-clipping describe block. AGENT.md's `buildPath`/`gridlineYs`
fragile-surface entries (lines 29, 43) accurately describe the margined-domain
contract, the "do not set `CHART_DOMAIN_MARGIN` to 0" warning, the labels-on-raw-
min/max promise, and the unchanged TD-33 scope. No doc contradicts the code.

**Standing checklist (Step 4).**
- Working tree clean — `git status --porcelain` empty. OK.
- STATUS.md — 11 lines, links only, no narrative, within limits. OK (see DIP-S1
  for a minor field-name nit carried over from prior reviews).
- Files conform to templates — plans/INDEX shows the plan `in review` (correct
  lifecycle); reviews/INDEX row added by this review; TECH_DEBT.md/DECISIONS.md
  formats intact. OK.
- Secrets — secret-scan passes; no keys/tokens in the delta. OK.
- Verify block — present in AGENT.md, single command, runnable, passes 141/141. OK.

## Findings

### DIP-Q1 — QUESTION
**File:** `components/portfolio-chart.tsx` (dashboard hero), `components/research/detail-price-chart.tsx` (research Overview/Technical)
**Problem:** Correctness of the geometry, the domain-registration invariant, the
labels-on-true-min/max promise, and margin sufficiency are all verified
statically and by the bezier-sampling test. What cannot be verified without a
running browser is the live visual acceptance: on the owner's real data (a) the
dip before the recent spike is fully visible inside the plot (its lowest point
sits above the bottom axis line, not under it), (b) the spike is exactly as tall
as before, (c) the y-axis price labels still read the real series min/max, and
(d) the hover dot tracks the line at the dip. No Playwright run was performed.
**Recommendation:** Owner performs the visual click-through (dashboard chart on
the real portfolio, plus a spiky 6M/1Y research chart with a reference line if
present) and confirms the four points above. This is an owner-acceptance gate,
not a code change.

### DIP-S1 — SUGGESTION
**File:** `STATUS.md:4,8`
**Problem:** STATUS.md uses `Orchestration:` and `Reviewer: running (iteration
1)` fields instead of the template's `Next:` field. It is within the 20-line /
links-only limit and not a defect in substance, but it is a small drift from the
STATUS.md template structure — the same nit prior reviews on this branch logged
(e.g. SVF-S2). Optional.
**Recommendation:** When the orchestration next clears STATUS.md, align to the
template's `Next:` field (or the framework owner decides these orchestration
fields are an accepted local extension and documents them). No action required
for this fix to land.

## Proposed DECISIONS.md entries
None. Per the plan (Task 5, "## Designer", and "## Open decisions: None"), this
is a geometry bug fix reconciling the drawing domain, not a new architectural
decision — the rationale lives in the plan and in AGENT.md's fragile-surface
entries. No ADR is warranted.
