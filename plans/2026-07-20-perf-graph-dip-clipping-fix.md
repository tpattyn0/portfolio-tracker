# Plan: Performance-chart dip clips below the bottom axis — keep the whole line inside the plot
Date: 2026-07-20

## Problem

On the dashboard performance chart (`components/portfolio-chart.tsx`, ADR-10), the
**dip just before the recent spike** (owner's data, around Jul 17–18) renders
**below the bottom axis line / under the x-axis** and disappears out of the plot
area. The owner has clarified:

- The **spike** near Jul 17 → Jul 20 is **correct** and must stay — it's a real
  portfolio rise from newly bought positions. The prior
  `plans/2026-07-20-perf-graph-spike-fix.md` misread this as a spurious spike and
  is **superseded** — do not re-open same-day bucketing.
- The **real bug** is the **dip clipping below the plot floor**: the low point of
  the line (and the curve around it) draws below `CHART_HEIGHT`, so the bottom of
  the dip is cut off by the SVG viewBox and hidden under the bottom axis `<line>`.

This is a **rendering/geometry bug**, not a data bug. The prior axis-scaling fix
(`plans/2026-07-20-small-visual-fixes.md` Issue 4) already made gridlines/labels
data-derived (`gridlineYs`) and confirmed `buildPath` maps the series into a
padded plot area — so at the **data vertices** the min plots exactly on the
bottom plot floor and is *not* clipped. The clip comes from what happens
*between* vertices.

### Root cause (verified, not guessed)

`buildPath` (`lib/utils/chart-path.ts:30-77`) plots each value with:

```
y(v) = padding + (1 - (v - min) / range) * (height - 2 * padding)
```

computed from the series' **own** `min`/`max`. So the series **minimum vertex maps
to exactly `height - padding`** (e.g. 220 − 8 = **212**, the bottom plot floor) —
leaving **zero vertical room below it**. The line is then drawn as a
**Catmull-Rom → cubic-bezier spline** (`chart-path.ts:61-74`): the control points
`c1y = p1.y + (p2.y - p0.y)/6` and `c2y = p2.y - (p3.y - p1.y)/6` let the
interpolated curve **overshoot past a vertex**, and the overshoot magnitude scales
with the **y-slope of that vertex's neighbours**.

The owner's exact shape — a **low dip immediately followed by a steep spike** (new
positions → large series max → very steep recovery segment) — is the worst case:
the dip's min vertex sits on the floor (y=212) and the steep recovery on the
right pulls the spline **downward past the min**, i.e. to **y > 212**, below the
plot floor. With a steep enough recovery it passes the **bottom axis line**
(`CHART_HEIGHT - 1` = 219, drawn at `portfolio-chart.tsx:228`) and even the
**viewBox bottom** (220), where `preserveAspectRatio="none"` + no clip-path simply
cuts it off. That is the dip "disappearing under the x-axis."

Verified with a probe reconstructing dip-then-spike series (`scratch/`, gitignored,
not committed) sampling the actual bezier segments:

| Series shape | curve max y | vs floor (212) | vs axis (219) | vs viewBox (220) |
|---|---|---|---|---|
| gentle dip + gentle spike | 212.07 | +0.07 below | — | — |
| sharp V-dip then steep spike | 215.03 | +3.03 below | — | — |
| min 2nd-to-last, then spike | 215.62 | +3.62 below | — | — |
| **min last-but-one, huge final spike** | **219.64** | **+7.64 below** | **+0.64 below axis** | — |

The steeper the post-dip recovery (the bigger the owner's real spike), the further
the dip overshoots below the floor and axis. The **vertex** min/max always land at
8..212 (that part of the last fix is correct and stays); the **spline overshoot**
is what clips.

**Why the candidate causes in the brief are not the culprit (ruled out against the code):**
1. *y-domain / nice-rounding mismatch* — **not the cause.** `buildPath` computes its
   domain from the series' own `min`/`max` (`chart-path.ts:48-50`); `gridlineYs`
   and `niceYTicks` are passed the **same** `yMin`/`yMax` (`portfolio-chart.tsx:149-156`).
   `niceYTicks` does **not** round (`chart-ticks.ts:20-42` — it returns evenly
   spaced values between the raw min and max). Domain and ticks agree; there is no
   nice-rounding floor above the true min.
2. *SVG clip-path / overflow* — there is **no** `clipPath` and no `overflow:hidden`;
   the only clip is the **viewBox itself** (`preserveAspectRatio="none"`), which is
   what cuts the overshoot once it passes y=220.
3. *area-fill baseline* — the area fill baseline is fine
   (`buildAreaPath` drops to `height`, `chart-path.ts:84-87`); the **line stroke**
   is what dips below, not the fill.
4/5. *padding asymmetry / ordering* — not applicable; the mapping is symmetric and
   the domain includes all points including the most recent.

So the single fix is: **give the spline vertical headroom below the true min (and
above the true max) so its overshoot stays inside the plot** — i.e. the plotted
**drawing domain** must extend slightly beyond the raw series min/max, while the
**gridlines/labels** continue to mark the real data values.

## Approach

Introduce a small **symmetric domain margin** so the drawing domain that
`buildPath` maps into is `[min − m, max + m]` for a margin `m` proportional to the
series range, instead of exactly `[min, max]`. This pushes the min vertex up off
the floor (and the max vertex down off the ceiling) by a few pixels, giving the
Catmull-Rom overshoot room to stay within `[padding, height − padding]`.

Key design points:

- **One domain, shared by both consumers.** The margined domain
  (`domainMin`/`domainMax`) must be used by **both** `buildPath` (the drawing) **and**
  `gridlineYs` (the gridline pixel positions), so line and gridlines stay
  registered — exactly the invariant the last fix (`gridlineYs`) established. The
  `niceYTicks` **label values** stay derived from the **true** series `min`/`max`
  (they are the numbers the user reads); only the **pixel mapping** uses the
  margined domain. Because gridlines are positioned via `gridlineYs(domainMin,
  domainMax, …, ticks)` using the same domain the line uses, a tick at the true min
  will now sit slightly **above** the bottom plot floor — correct, because there is
  now headroom below it, and the line's dip lives in that headroom instead of below
  the axis.
- **Margin lives in `buildPath` as an optional param**, defaulting to a value that
  fully contains the worst-case overshoot. Catmull-Rom overshoot for this control-
  point formula is bounded by roughly a fraction of the neighbouring segment's
  vertical delta; a domain margin of **~8% of the series range** converts the
  worst-case probe (219.64, i.e. 7.64px below a 212 floor on a 204px plot band ≈
  3.7% of the band) to comfortably inside, with margin to spare. The exact default
  is chosen so the probe's steepest case maps `< height − padding`. Making it a
  parameter (not a hardcoded literal buried in the map) keeps `buildPath` a pure,
  testable function and lets both charts pass the same value.
- **Both charts get the fix.** `detail-price-chart.tsx` (ADR-11) uses the identical
  `buildPath` + `gridlineYs` pair with the same `padding=8` and the same true-min-on-
  floor geometry (height 190 → floor 182, axis 189). A spiky research series
  (6M/1Y) can clip the same way. Apply the same margined-domain change there.

### Implementation shape (spec, not authored code)

`buildPath(values, width, height, padding = 8, domainMargin = 0)`:
- compute `min`/`max` as today, then `m = (max − min) * domainMargin`,
  `domainMin = min − m`, `domainMax = max + m`, `range = (domainMax − domainMin) || 1`.
- map each `v` through `domainMin`/`range` instead of `min`/`range`. With
  `domainMargin = 0` the behaviour is **identical to today** (backward compatible;
  existing `buildPath` tests keep passing unchanged).

Expose a shared constant (e.g. `CHART_DOMAIN_MARGIN`) from `chart-path.ts` so both
components pass the same value to **both** `buildPath` and their domain computation,
and compute `domainMin`/`domainMax` the same way for `gridlineYs`. To avoid
duplicating the margin arithmetic in two components, add a tiny pure helper
`marginDomain(min, max, margin)` → `{ domainMin, domainMax }` in `chart-path.ts`,
used by each component to derive the domain it passes to `gridlineYs` (and, if
clearer, that `buildPath` also accepts). This keeps "the domain buildPath draws
into" and "the domain gridlineYs positions against" provably identical — a single
source of truth, closing the same class of drift the last fix addressed.

The bottom axis `<line>` at `CHART_HEIGHT - 1` and the fill baseline at
`CHART_HEIGHT` are unchanged — with the dip now inside the padded band, they no
longer overlap the line.

## Tasks

1. [ ] **Add margined-domain support to `buildPath` + a `marginDomain` helper**
   (`lib/utils/chart-path.ts`). Add optional `domainMargin` param to `buildPath`
   (default `0` = current behaviour) that expands the drawing domain symmetrically
   before mapping; add pure `marginDomain(min, max, margin)` returning
   `{ domainMin, domainMax }`; export a `CHART_DOMAIN_MARGIN` constant. Update the
   `buildPath` doc comment to describe the overshoot-headroom purpose.
   — Acceptance: `npm run test` green; existing `buildPath`/`gridlineYs` tests pass
   unchanged (margin defaults to 0). New unit test (Task 2) passes.

2. [ ] **Unit test reproducing the clip and asserting the fix**
   (`lib/utils/chart-path.test.ts`). Add a `describe` that, for a dip-then-steep-spike
   series (min immediately followed by the series max), samples the actual bezier
   curve (reuse the segment/control-point math) and asserts:
   (a) with `domainMargin = 0` the curve's max y **exceeds** `height − padding`
   (reproduces the clip — the guard against regressing the fix), and
   (b) with `domainMargin = CHART_DOMAIN_MARGIN` the curve's max y is **≤ `height − padding`**
   and its min y is **≥ `padding`** (whole line inside the plot). Also assert
   `marginDomain` returns `[min, max]` unchanged when margin is 0 and a symmetric
   expansion otherwise.
   — Acceptance: the test fails against the pre-fix `buildPath` (margin ignored) and
   passes after Task 1; `npm run test` green.

3. [ ] **Apply the margined domain in `portfolio-chart.tsx`.** Derive
   `{ domainMin, domainMax }` via `marginDomain(yMin, yMax, CHART_DOMAIN_MARGIN)`;
   pass `CHART_DOMAIN_MARGIN` to `buildPath`; pass `domainMin`/`domainMax` (not raw
   `yMin`/`yMax`) to `gridlineYs`; keep `yTicks = niceYTicks(yMin, yMax, 3)` (label
   values stay the true data values); update the hover-marker `hoverYFrac`
   denominator to use the **same margined range** so the marker stays registered
   with the line.
   — Acceptance: `npm run typecheck`/`lint`/`test` green; manual check in Verification
   (dip fully visible, gridline labels still read the real min/max, hover dot tracks
   the line at the dip).

4. [ ] **Apply the identical change in `research/detail-price-chart.tsx`.** Same
   `marginDomain` + `buildPath` margin + `gridlineYs` domain + hover-`valueRange`
   update; keep `niceYTicks(min, max, 3)` labels on the true min/max; the
   reference-line clamp (`Math.max(min, Math.min(max, ref.value))`) stays on the true
   min/max (a level at the true min should render at the label, not the margin edge)
   — but its `yFrac` denominator must use the **same margined range** as the line so
   a reference line at the true min sits exactly where the line's min vertex now
   sits. Confirm this registration in the task's manual check.
   — Acceptance: `npm run verify` green; manual check (spiky research chart's low
   dip stays inside the plot; y-labels unchanged; reference line, if present, lands
   on the line's corresponding value).

5. [ ] **Docs.** Update `AGENT.md`'s `gridlineYs()` fragile-surface entry (and the
   `buildPath` entry) to note the margined drawing domain: the domain passed to
   `buildPath` **and** `gridlineYs` is now `marginDomain(min, max, CHART_DOMAIN_MARGIN)`,
   while `niceYTicks` labels stay on the raw min/max — and that the margin exists to
   contain Catmull-Rom overshoot below the true min (do not set it to 0 or the dip
   re-clips). Add the two chart components to "Known fragile surfaces" if not already
   precise. No ADR (this is a bug fix reconciling the drawing domain, not a new
   architectural decision — the geometry rationale lives here + in AGENT.md).
   — Acceptance: `AGENT.md` reflects the margined domain; `plans/INDEX.md` row
   updated by the Coding agent per lifecycle.

Task status markers: `[ ]` todo · `[~]` in progress · `[x]` done (acceptance passed) · `[!]` blocked

## Files to create or modify

- `lib/utils/chart-path.ts` — `buildPath` `domainMargin` param, `marginDomain` helper, `CHART_DOMAIN_MARGIN` export, doc update.
- `lib/utils/chart-path.test.ts` — new clip-reproduction + margin tests.
- `components/portfolio-chart.tsx` — margined domain for `buildPath` + `gridlineYs` + hover.
- `components/research/detail-price-chart.tsx` — same margined domain.
- `AGENT.md` — fragile-surface note update.

## Verification

`npm run verify` (AGENT.md Verify block) covers typecheck + lint + tests + secret scan.

Beyond it — manual/visual (owner or Playwright):
- **Dashboard chart, owner's data:** the dip before the recent spike is **fully
  visible inside the plot** — its lowest point sits above the bottom axis line, not
  under it. The spike stays exactly as tall as before (unchanged max behaviour).
- **Gridline labels unchanged:** the y-axis price labels still read the real series
  min/max (they are `niceYTicks(min, max)` values), just positioned with a little
  headroom below the bottom label.
- **Hover registration:** hovering the dip places the marker dot on the line at the
  dip (marker uses the same margined range as the line).
- **Research detail chart:** a spiky 6M/1Y series' low dip likewise stays inside the
  plot; reference lines (Technical, when present) still land on their value.
- **No regression on flat/degenerate series:** flat series still renders a centered
  midline (margin of a zero range is zero → unchanged).

## Assumptions

- **Symmetric proportional margin is acceptable.** A drawing domain of
  `[min − m, max + m]` with `m ≈ CHART_DOMAIN_MARGIN × range` adds a few px of
  whitespace above the max and below the min so the spline never clips. This is the
  sensible default the brief endorses ("domain contains the data with a little
  symmetric padding"). The gridline **labels** still show the true min/max, so no
  number the user reads changes — only a small amount of plot whitespace is added.
  If the owner prefers zero whitespace at the top (max flush to the ceiling) the
  margin could be applied to the bottom only; the symmetric default is chosen for
  visual balance and because the max can also overshoot upward on a spike-then-dip
  shape.
- The exact `CHART_DOMAIN_MARGIN` value is tuned in Task 1/2 so the probe's steepest
  dip-then-spike case maps strictly inside `[padding, height − padding]` with a small
  safety factor; ~0.08 (8% of range) is the starting point and the test in Task 2
  is the guard that it is sufficient. This is a tuning constant, not a design
  decision requiring sign-off.

## Open decisions

None. The fix is a determinable geometry correction; the one small visual choice
(a little symmetric whitespace vs. bottom-only) is resolved by a sensible default in
Assumptions and does not block the Coding agent.

## Designer

Not required. The fix keeps the line inside the **existing** plot area and adds no
new visual token, color, or component — it only stops the dip from clipping. The one
DESIGN.md-adjacent fact (gridlines are data-derived; y-labels show the real min/max)
is **preserved**, not changed: labels remain the true series values. Task 5 updates
`AGENT.md` (developer-facing), not `DESIGN.md`. If the owner later wants the margin
amount treated as a documented design token, that is a small follow-up Designer note,
not a blocker for this fix.
