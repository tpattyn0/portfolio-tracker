# Review: small-visual-fixes
Date: 2026-07-20
Status: IMPLEMENTED — 2026-07-20

## Summary
Findings: [0 BLOCKERs, 0 ISSUEs, 2 SUGGESTIONs, 2 QUESTIONs]
Requires owner decision: SVF-Q1 (per-issue visual click-through acceptance), SVF-Q2 (TD-36 dead-`border-line` convergence — Designer routing)
Ready for Coding agent: SVF-S1, SVF-S2 (both optional, low priority)

Review target: branch HEAD `975ce3ae` (working tree clean at review time; the trailing `aef0a309` is a STATUS.md-only chore). Scope is the small-visual-fixes delta `c1e8222c..975ce3ae` only — the older already-IMPLEMENTED research-tab-fixes / analyst-revisions work on this branch was not re-reviewed (owner directive; those carry `Status: IMPLEMENTED`). Owner decisions taken as given: OD-1 = no change to the intrinsic 0.0 score; OD-2 = axis-scaling fix only, no data clamping.

Verify block (`npm run verify`) run independently: typecheck ok · lint ok · 135/135 tests · secret-scan no leaks. Green.

The two real bug-risk spots — the `gridlineYs` math and the Overview five-query loading gate — were both verified **statically and concretely** (not deferred to click-through). Both are correct. No BLOCKER or ISSUE.

## Findings

### SVF-S1 — SUGGESTION
**File:** `lib/utils/chart-path.ts:117,119-121` (`gridlineYs` flat-series branch)
**Problem:** For a degenerate flat series (`yMax === yMin`), `gridlineYs` maps every tick to the vertical *midpoint* (`padding + (height - 2*padding) / 2`), whereas `buildPath`'s own flat-series path (via the `range = max - min || 1` guard on line 50) plots the flat line at the *bottom* of the padded domain (`height - padding`, since `(v - min)/1 = 0` → `y = padding + 1*(height - 2*padding) = height - padding`). So on a perfectly flat series the single collapsed gridline/label would sit at mid-height while the drawn line sits at the bottom — the exact "label doesn't match the line" class of mismatch this fix set out to close, just in the one degenerate case. The doc comment (lines 104-106) claims the flat branch matches `buildPath`'s flat behavior; it does not. Impact is cosmetic-only and the trigger (a 1Y price or portfolio series with a byte-identical value at every point) is effectively never hit with real data, so this is not an ISSUE — but the code and its comment disagree with `buildPath`.
**Recommendation:** Either return `padding + (height - 2*padding)` (the bottom, matching `buildPath`'s `|| 1`-guarded flat output) from the `range === 0` branch, or leave the value as-is and correct the comment to state it intentionally centers the flat-series gridline rather than mirroring `buildPath`. Optional; pick whichever the Designer prefers for the flat-series look. Add a test asserting the chosen behavior. Out of scope for OD-2 if treated as a chart-math change — safe to defer.

### SVF-S2 — SUGGESTION
**File:** `STATUS.md:4,8`
**Problem:** STATUS.md is within the 20-line / links-only limit (11 lines, no prose paragraphs), but two of its `## In progress` fields deviate from the template's field set: an `Orchestration:` narrative line (a one-line description of the four issues) and `Reviewer: running (iteration 1)` in place of the template's `Next:` field. Minor structural drift from the STATUS.md template in CLAUDE.md — not a limit breach.
**Recommendation:** On the next STATUS.md touch, drop the `Orchestration:` description line (the plan link already carries that detail) and use `Next: <actor>` rather than a custom `Reviewer: running` field. Cosmetic; does not block.

### SVF-Q1 — QUESTION
**File:** `components/intrinsic-value.tsx:113`, `components/news-feed.tsx:116`, `components/portfolio-chart.tsx`, `components/research/detail-price-chart.tsx`, `components/overview.tsx`
**Problem:** The four owner-reported symptoms are visual and were verified by reading the code, not by driving the browser (no Playwright pass in this review). The math and control-flow are confirmed correct statically: (1) the two dividers are removed with `pt-5` spacing preserved; (2/3) the Overview composite card now holds its single "Loading overview…" state until all five queries resolve, so the composite/SubscoreBand no longer paints from a fabricated neutral-5 and jumps; (4) both charts derive gridline/label y-positions from the same padded domain `buildPath` plots into, so a spiky series' max/min land on the top/bottom gridlines. What remains is owner visual acceptance that each looks right on live symbols.
**Recommendation:** Owner (or a Coding-agent Playwright pass) confirms on a live symbol: no rule above the Intrinsic Bear/Base/Bull band or the News tone band; the Overview score appears once at its final value with no flicker/empty-figure flash; the performance-chart line stays within the labelled gridline band across ranges (try a spiky range like 5Y/10Y). No code action expected unless a symptom persists.

### SVF-Q2 — QUESTION
**File:** `TECH_DEBT.md` TD-36; `components/analyst-ratings.tsx:151`, `components/technical-analysis.tsx:198`, `components/fundamental-analysis.tsx:111,141`, `components/research/transactions-tab.tsx:161,174,215`
**Problem:** TD-36 (newly logged) correctly documents that `border-line` is a dead/no-op Tailwind class app-wide: I confirmed `tailwind.config.js` defines only `line2: 'var(--line2)'` (line 61) with no `line` entry, and `app/globals.css` defines `--line2` but no `--line`. The five other bands still carrying `border-line` draw their rule off `border-t`/`border`'s *default* border color rather than the intended token. This fix deliberately scoped to only the two owner-named bands (Intrinsic + News). Whether the remaining five bands should also lose their top rule (system-wide convergence) or keep an intentional rule (retokenized to `border-line2`) is a design decision, correctly deferred here.
**Recommendation:** Route TD-36 to the Designer before any code change on the five remaining `border-line` sites — decide per band (drop the rule vs. retokenize to `border-line2`), not a blanket find/replace, per the TD-36 note. This is a code-hygiene follow-up, not part of this fix.

## Correctness verification detail (no findings — recorded for the audit trail)

**(A) `gridlineYs` mirrors `buildPath` — verified exact.** `gridlineYs` (chart-path.ts:123) returns `padding + (1 - (v - yMin) / range) * (height - 2 * padding)`, character-for-character the same mapping as `buildPath`'s per-point `y` (chart-path.ts:54). Tests assert exact pixels: `gridlineYs(0,100,220,8,[100,50,0])` → `[8, 110, 212]` (top/mid/bottom of the 8..212 plot band), plus a `buildPath`-parity test that the series' actual max/min land at `padding` / `height-padding`. Single-tick, empty-ticks, and flat-series (no div-by-zero) cases are all covered. The only divergence is the flat-series *position* (SVF-S1), which is cosmetic and untestably-rare. Both `portfolio-chart.tsx` (line 142/156) and `detail-price-chart.tsx` (line 65/75) pass the same `CHART_PADDING = 8` and the same series `min`/`max` to both `buildPath` and `gridlineYs` — no padding or domain drift. The old fixed `GRIDLINE_Y = [55,110,165]` / `[47,94,141]` constants are fully removed (ripgrep across `components/` + `lib/` returns nothing). `detail-price-chart.tsx`'s reference-line clamping (line 152, `Math.max(min, Math.min(max, ref.value))`) is untouched and still functions. `niceYTicks` returns ticks strictly within `[min, max]` (spans `hi..lo` inclusive, no nice-number rounding beyond the range), so `gridlineYs` never maps a tick outside `[padding, height-padding]` — no clipping.

**(B) Overview gate keys on `isLoading`, not `isPending` — no infinite-loading regression.** `overview.tsx:165-170` ORs `chartQ.isLoading || fundamentalsQ.isLoading || analystQ.isLoading || intrinsicQ.isLoading || newsQ.isLoading`. `intrinsicQ` is the only disable-able query (`enabled: currentPrice > 0`, line 60). In React Query v5, `isLoading === isPending && isFetching`; a disabled query has `isFetching === false`, so `intrinsicQ.isLoading === false` when `currentPrice <= 0` — the gate resolves rather than hanging on "Loading overview…" forever. Had the gate used `isPending`, that disabled query would pin the card open indefinitely; it does not. The resolved-but-empty / errored fallback (each subscore `useMemo` keyed on `.isError`, defaulting to neutral `5`) is unchanged — only the newly-added pending gate was introduced.

**(C) Divider + scope — clean.** `git diff` on `intrinsic-value.tsx` and `news-feed.tsx` shows only `border-t border-line` → (nothing), `pt-5` retained, no other change. No analyst-ratings / technical-band / chart-data-clamping / intrinsic-score-logic changes leaked in (OD-1/OD-2 honored). `overview.tsx` diff is the `isLoading` gate only.

**Security pass (Step 1, folded in — no findings).** The delta is a pure numeric chart helper (`gridlineYs`), a React Query loading-flag change (`overview.tsx`), numeric SVG coordinate wiring, and removal of two dead CSS classes. No new endpoints, auth boundaries, DB writes, deserialization, or secrets. All chart values pass through `Number.isFinite` and render as numeric SVG attributes; no `dangerouslySetInnerHTML` or other unsafe sink — no XSS surface. Clean. (The `security-review` skill was run against the full branch diff, which includes older already-IMPLEMENTED work out of this review's scope; nothing in the small-visual-fixes delta surfaced.)

**Test coverage.** `gridlineYs` has 6 meaningful unit tests (exact-pixel mapping, `buildPath` parity, flat-series, single-tick, empty-ticks, default-padding) — adequate. The Overview five-query gate has no unit test; judged **acceptable** — it is component loading-state logic with no component-test harness configured in this project (vitest is unit-only here), and the flag semantics are verified statically above. Not flagged as an ISSUE.

## Proposed DECISIONS.md entries
None. This change is presentational/loading-behavior only and introduces no new architectural decision — the design rationale is captured in DESIGN.md and the two AGENT.md fragile-surface entries (both verified accurate against the code), and OD-1/OD-2 were resolved at plan time.
