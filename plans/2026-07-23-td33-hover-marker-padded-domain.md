# Plan: TD-33 — hover marker (and reference line) y-position on the padded domain
Date: 2026-07-23

## Problem

Both inline-SVG charts position their hover marker dot at a vertical fraction that
omits the plot padding, while gridlines, y-axis labels, and the plotted line
itself all use the padded domain. The marker therefore drifts off the line it is
supposed to sit on.

Verified against HEAD `2f1e376f` (+ the TD-33 citation correction `5d6575a7`):

- `components/portfolio-chart.tsx:173`
  `const hoverYFrac = hoverValue !== undefined ? 1 - (hoverValue - domainMin) / domainRange : 0;`
  consumed at `:253` as `top: ${hoverYFrac * 100}%` (marker dot) and at `:259` as
  `top: ${Math.max(0, hoverYFrac * 100 - 4)}%` (tooltip card).
- `components/research/detail-price-chart.tsx:133`
  `const hoverYFrac = hoverPoint ? 1 - (hoverPoint.value - domainMin) / valueRange : 0;`
  consumed at `:203` (marker dot) and `:209` (tooltip card).
- `components/research/detail-price-chart.tsx:173-174` — the dashed reference line
  computes `const yFrac = 1 - (clampedValue - domainMin) / valueRange;` then
  `const y = yFrac * CHART_HEIGHT;`, the same padding-omitting mapping, but in SVG
  user units rather than CSS percent.

Meanwhile `buildPath` (`lib/utils/chart-path.ts:110`) and `gridlineYs`
(`:179`) both map a value to
`padding + (1 - (v - domainMin) / range) * (height - 2 * padding)`.

**Magnitude (re-derived, not assumed).** With `padding = 8`, the discrepancy is
`(padding + f*(height - 2*padding)) - f*height`, i.e. `padding * (1 - 2f)`:

| chart | height | at series max (`f=0`) | at midline (`f=0.5`) | at series min (`f=1`) |
|---|---|---|---|---|
| `portfolio-chart.tsx` | 220 | marker 8px **too high** (3.64% of height) | exact | 8px **too low** (3.64%) |
| `detail-price-chart.tsx` | 190 | 8px too high (4.21%) | exact | 8px too low (4.21%) |

So the marker is correct only at the vertical centre and worst at the extremes —
exactly where a user hovers a peak or a trough. TD-33's "~3.6%" figure is the
220-tall case; the 190-tall detail chart is slightly worse at 4.21%.

DESIGN.md specifies the intended behaviour for both charts already: "an `--ink`
marker dot **on the line** at the nearest data point" (DESIGN.md:399-400 for
`DetailPriceChart`, :1256-1264 for the hero). This is a conformance fix to an
existing spec, not a new visual treatment.

AGENT.md:42 already documents this exact residual gap as unchanged TD-33 scope
after the 2026-07-20 dip-clipping fix, and explicitly names the reference line
alongside the hover marker. Both are in scope here; closing only the marker would
leave the documented gap half-open.

## Approach

**One shared helper, both call sites, both charts, plus the reference line.**

### Decision 1 — add `plotYFraction()` to `lib/utils/chart-path.ts` rather than call `gridlineYs(...)[0]`

TD-33's recommended fix offers either. Choosing the dedicated helper:

- `gridlineYs(min, max, h, p, [v])[0]` allocates a one-element array on every
  render. The hero chart re-renders on every `mousemove` (`setHoverIndex`) *and*
  on every RAF frame of the 500ms range-morph (`setAnimatedValues`), so this sits
  on the hottest render path in the app. Not a correctness argument, but it is a
  free avoidance.
- More importantly it reads wrong. `gridlineYs` is named and documented for
  *gridline tick* positioning; `[0]` on a single-element array to get a marker
  position is an idiom a future reader has to decode. A named
  `plotYFraction(value, domainMin, domainMax, height, padding)` says what it does.
- Single source of truth is preserved either way, because `gridlineYs` will be
  refactored to call the new helper internally (see Task 1) — there will still be
  exactly one place the `padding + (1 - f) * (height - 2*padding)` formula lives.

### Decision 2 — the helper returns a **fraction of height**, and `gridlineYs` keeps returning SVG units

The two consumers want different units:

- The marker/tooltip are HTML overlay divs positioned in CSS percent
  (`top: ${x}%`), because the SVG is `preserveAspectRatio="none"` and cannot be
  used for un-distorted overlay geometry (existing comment, `portfolio-chart.tsx:243-244`).
- The reference line is an SVG `<line y1=… y2=…>` in viewBox user units.
- The gridlines are SVG `<line>` in user units (`:236`), but their *labels* are
  HTML divs that already convert back via `gridYs[i] / CHART_HEIGHT * 100`
  (`portfolio-chart.tsx:217`, `detail-price-chart.tsx:145`).

A fraction is the common currency: `frac * 100` gives the CSS percent, `frac *
height` gives the SVG user unit. So:

```
plotYFraction(value, domainMin, domainMax, padding, height) -> number in [0,1]
gridlineYs(...)  ->  ticks.map(v => plotYFraction(v, yMin, yMax, padding, height) * height)
```

This is deliberately **not** the "follow the `/ CHART_HEIGHT * 100` pattern at
`:217`" option. That pattern exists only because `gridlineYs` returns pixels and
the label needs percent — round-tripping pixels for a value that was never needed
in pixels adds a conversion for nothing. The two charts end up consistent with
each other either way; the fraction form is consistent with *more* of the file.

Signature note: parameter order is `(value, domainMin, domainMax, padding,
height)` — padding before height, matching neither `buildPath` nor `gridlineYs`
exactly (both put `height` before `padding`). Prefer matching the existing
convention: **`plotYFraction(value, domainMin, domainMax, height, padding = 8)`**,
mirroring `gridlineYs(yMin, yMax, height, padding, ticks)`'s ordering and its
`padding = 8` default. Keep it that way.

### Decision 3 — the `- 4` tooltip offset stays untouched

Investigated. At `portfolio-chart.tsx:255-261` / `detail-price-chart.tsx:205-211`
the tooltip card carries **both** `top: ${Math.max(0, hoverYFrac * 100 - 4)}%`
**and** `transform: translate(<x>, -100%)`. The `-100%` lifts the card fully above
its anchor point; the `- 4` then adds a further 4%-of-container gap so the card
does not touch the dot, and `Math.max(0, …)` prevents a negative `top` when the
hovered point is near the top of the plot.

It is therefore an **independent visual gap offset applied on top of the marker's
position**, not a second (wrong) copy of the domain mapping. Once `hoverYFrac`
is corrected, the tooltip inherits the correction automatically and keeps the
same 4% standoff from the dot. Do not "also fix" the `- 4`, and do not convert it
into padded-domain units — it is a percent-of-container spacing constant, in the
same space as the value it is subtracted from. No change.

### Decision 4 — structural differences between the two charts (checked, they are compatible)

- Padding/height constants: `portfolio-chart.tsx:35-36` has `CHART_HEIGHT = 220`,
  `CHART_PADDING = 8`. `detail-price-chart.tsx:37-38` has `CHART_HEIGHT = 190`,
  `CHART_PADDING = 8`. **Different heights, same padding.** Both already pass
  their own constants into `buildPath`/`gridlineYs`; the new helper takes the same
  two, so no new constant and no new sync hazard is introduced. (The existing
  "must match buildPath's default padding — kept in sync explicitly" comment on
  both files stays accurate and unchanged.)
- Domain variables: the names differ but the values do not. `portfolio-chart.tsx:172`
  `domainRange = domainMax - domainMin || 1`; `detail-price-chart.tsx:131`
  `valueRange = domainMax - domainMin || 1`. **Both are already the margined
  (padded-domain) range** — `domainMin`/`domainMax` come from `marginDomain(...)`
  in both files (`:155` and `:75`). So the domain half of the mapping is already
  correct in both; only the padding half is missing. This means the fix is
  strictly the padding term, and no domain change is in scope.
- After the refactor both local `domainRange`/`valueRange` consts become unused in
  the hero chart (its only consumer was `hoverYFrac`) but are **still used** in the
  detail chart by the reference-line block (`:173`). Handle per Task 3/4 notes —
  remove where genuinely dead, keep where still read, and let `next lint` confirm.

### Decision 5 — reference line converts through the same helper, keeping its clamp

`detail-price-chart.tsx:162-187` clamps `ref.value` to the **true** `[min, max]`
(not the margined domain) before mapping, deliberately (MRD-S2 — a level from a
wider lookback should land at the plot's true data edge rather than clip off the
SVG). That clamp is behaviour, not a mapping bug: keep it exactly as is. Only the
final two lines change from

```
const yFrac = 1 - (clampedValue - domainMin) / valueRange;
const y = yFrac * CHART_HEIGHT;
```
to
```
const y = plotYFraction(clampedValue, domainMin, domainMax, CHART_HEIGHT, CHART_PADDING) * CHART_HEIGHT;
```

No caller passes `referenceLines` today (TD-DTL-SR — `technical-analysis.service.ts`
computes no support/resistance levels, and DESIGN.md:408-409 forbids fabricating
one), so this is not user-visible now. It is fixed anyway because leaving a second
copy of the wrong formula in the file is exactly how this class of drift recurs,
and AGENT.md:42 names it as TD-33 scope.

### Explicitly out of scope

- No change to `buildPath`, `buildAreaPath`, `marginDomain`, `CHART_DOMAIN_MARGIN`,
  or `niceYTicks`.
- No change to the domain (margining) — already correct in both charts.
- No merging of the two chart components (ADR-11, AGENT.md:29 — needs a Designer
  decision, not this fix).
- No component-render tests (TD-38 — no jsdom seam; see Verification).
- No new DESIGN.md tokens or spec change — the fix restores conformance to the
  existing spec text.

## Tasks

1. [ ] **Add `plotYFraction()` to `lib/utils/chart-path.ts` and refactor `gridlineYs` onto it.**
   Signature `plotYFraction(value: number, domainMin: number, domainMax: number, height: number, padding = 8): number`,
   returning `(padding + (1 - (value - domainMin) / range) * (height - 2 * padding)) / height`.
   Degenerate cases must mirror `gridlineYs` exactly: when `domainMax === domainMin`
   return the vertical midpoint fraction `(padding + (height - 2*padding) / 2) / height`
   (do NOT rely on a `|| 1` range guard here — `gridlineYs` uses an explicit
   `range === 0` branch and the two must not diverge). Then rewrite `gridlineYs`'s
   return as `ticks.map((v) => plotYFraction(v, yMin, yMax, height, padding) * height)`
   so the padded-domain formula exists in exactly one place. Doc-comment it with the
   same "must be passed the same domain used to call `buildPath`" warning
   `gridlineYs` already carries, and state that it returns a fraction (multiply by
   `100` for CSS percent, by `height` for SVG user units).
   — **Acceptance:** `npx vitest run lib/utils/chart-path.test.ts` passes with the
   pre-existing `gridlineYs` suite unmodified (its 6 tests are the regression guard
   that the refactor changed no gridline output), and `npx tsc --noEmit` is clean.

2. [ ] **Add unit tests for `plotYFraction` in `lib/utils/chart-path.test.ts`.**
   New `describe("plotYFraction")` block, covering:
   - *happy path / registration with `buildPath`:* for a series like `[10, 40, 25, 90, 5]`
     at `height=220, padding=8`, `plotYFraction(max, min, max, 220, 8) * 220` equals
     `padding` (8) and `plotYFraction(min, …) * 220` equals `height - padding` (212),
     to 5 decimal places — i.e. the same pixels `buildPath` plots those vertices at.
   - *cross-check against `gridlineYs`:* `plotYFraction(v, a, b, h, p) * h` equals
     `gridlineYs(a, b, h, p, [v])[0]` for several `v`. This is the invariant that
     makes marker/gridline drift impossible by construction; it is the single most
     valuable assertion in the block.
   - *the regression this closes (meaningful failure case):* assert the returned
     fraction is **not** the naive `1 - (v - min) / range` at the extremes —
     concretely, at the series max the fraction is `8/220` (≈0.0364), not `0`, and
     at the series min it is `212/220` (≈0.9636), not `1`. A test that only checked
     the midpoint would pass against the buggy formula, since the two agree exactly
     at `f = 0.5` — so the block must assert at the extremes.
   - *midline identity:* the mid value maps to `0.5` exactly (guards against an
     off-by-padding in the other direction).
   - *flat series (`domainMax === domainMin`):* returns the midpoint fraction, no
     `NaN`/`Infinity`, matching `gridlineYs`'s flat-series behaviour for the same inputs.
   - *190-tall geometry:* the detail chart's `height=190, padding=8` case maps max→`8/190`
     and min→`182/190`, so the helper is not accidentally hardcoded to the hero's 220.
   - *padding default:* `plotYFraction(v, a, b, h)` equals `plotYFraction(v, a, b, h, 8)`
     (mirrors the existing `gridlineYs` "defaults padding to 8" test).
   — **Acceptance:** the new block passes; deliberately reverting Task 1's helper body
   to the un-padded `1 - (v - domainMin) / range` makes the extremes and the
   `gridlineYs` cross-check tests fail (confirm locally, then restore).

3. [ ] **Switch `components/portfolio-chart.tsx`'s hover marker onto the helper.**
   Replace `:172-173` (`domainRange` + `hoverYFrac`) with
   `const hoverYFrac = hoverValue !== undefined ? plotYFraction(hoverValue, domainMin, domainMax, CHART_HEIGHT, CHART_PADDING) : 0;`
   and add `plotYFraction` to the existing `@/lib/utils/chart-path` import at `:6`.
   Remove the now-unused `domainRange` const (verify with `next lint` that nothing
   else reads it). The two consumers at `:253` and `:259` keep their existing
   `hoverYFrac * 100` / `Math.max(0, hoverYFrac * 100 - 4)` expressions **verbatim** —
   the helper returns a fraction, so those are already correct once the fraction is.
   Update the `:169-171` comment: it currently explains only the margined-domain half;
   extend it to say the padding term now comes from the shared helper so the marker,
   gridlines, and the plotted line all read one mapping.
   — **Acceptance:** `npx tsc --noEmit` clean, `next lint` reports no new unused-var
   warning for this file, and the `-4` offset expression at `:259` is byte-identical
   to before (`git diff` shows no change on that line).

4. [ ] **Switch `components/research/detail-price-chart.tsx`'s hover marker AND reference line onto the helper.**
   Replace `:133`'s `hoverYFrac` with the same `plotYFraction(hoverPoint.value,
   domainMin, domainMax, CHART_HEIGHT, CHART_PADDING)` form (guarded on `hoverPoint`,
   else `0`), and replace `:173-174` with
   `const y = plotYFraction(clampedValue, domainMin, domainMax, CHART_HEIGHT, CHART_PADDING) * CHART_HEIGHT;`
   — keeping the `clampedValue` line at `:172` and its MRD-S2 comment block
   (`:163-171`) intact, since the true-`[min,max]` clamp is deliberate behaviour.
   `valueRange` (`:131`) becomes unused once both consumers move — remove it and fold
   its explanatory comment's still-relevant content (that the marker and reference
   lines share one padded-margined mapping with `buildPath`/`gridlineYs`) into the
   remaining code. Add `plotYFraction` to the `:6` import. Consumers at `:203`/`:209`
   unchanged.
   — **Acceptance:** `npx tsc --noEmit` clean, `next lint` reports no new unused-var
   warning for this file, and `grep -n "1 - (.* - domainMin)" components/` returns
   **no** hits across the repo (the naive mapping is gone from both charts).

5. [ ] **Update the docs that describe this behaviour.**
   - `AGENT.md` — rewrite the tail of the `gridlineYs()` fragile-surface entry
     (currently AGENT.md:42, the sentence beginning "this does **not** fully close
     TD-33…"): TD-33 is now closed; state that `plotYFraction` is the single
     padded-domain value→y mapping, that `gridlineYs` is a thin wrapper over it, and
     that any future chart element positioned against the series (marker, reference
     line, annotation) must go through it rather than recomputing `1 - (v-min)/range`.
     Note the fraction return convention (`*100` for CSS percent, `*height` for SVG
     units) and that the tooltip's `- 4` is an independent standoff, not part of the
     mapping.
   - `TECH_DEBT.md` — move TD-33 from Backlog to the Resolved table with today's date
     and a one-line description; delete its Backlog row.
   - `ARCHITECTURE.md` — the `lib/utils/chart-path.ts` mention is via `AGENT.md`
     rather than the Key files table; check whether a row exists and add
     `plotYFraction` to any existing enumeration of the file's exports. If the file
     is not enumerated there, no change (do not add a new row just for this).
   - `DECISIONS.md` — add ADR-29 (see below).
   — **Acceptance:** `grep -n "TD-33" TECH_DEBT.md AGENT.md` shows TD-33 only in the
   Resolved table and (if referenced) as closed history in AGENT.md — no open-gap
   wording remains; `grep -n "ADR-29" DECISIONS.md` finds the new entry.

6. [ ] **Manual verification pass (see `## Verification`) and close-out.**
   — **Acceptance:** both manual checks below performed and their observed results
   recorded in the PR body.

## Files to create or modify

Modify:
- `lib/utils/chart-path.ts` — add `plotYFraction`, refactor `gridlineYs` onto it.
- `lib/utils/chart-path.test.ts` — new `describe("plotYFraction")` block.
- `components/portfolio-chart.tsx` — import, `hoverYFrac`, drop `domainRange`, comment.
- `components/research/detail-price-chart.tsx` — import, `hoverYFrac`, reference-line
  `y`, drop `valueRange`, comments.
- `AGENT.md` — `gridlineYs()` fragile-surface entry updated; TD-33 closed.
- `TECH_DEBT.md` — TD-33 Backlog → Resolved.
- `DECISIONS.md` — ADR-29.
- `ARCHITECTURE.md` — only if `chart-path.ts`'s exports are enumerated there.
- `plans/INDEX.md` — new row.

Create: none beyond the plan file itself.

No `DESIGN.md` change: the spec already says the dot sits on the line
(DESIGN.md:399-400, :1256-1264); the code was non-conformant, not the spec.

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs automatically and
covers typecheck, lint, the new unit tests, and the secret scan.

Beyond it — required, because TD-38 means there is **no component-render test
seam** in this repo (`vitest.config.ts` is `environment: "node"`, `include:
["**/*.test.ts"]`, no jsdom/happy-dom, `@testing-library/react` not installed), so
no automated assertion can cover the CSS-percent overlay positioning itself. The
pure-function tests in Task 2 prove the *mapping*; these manual checks prove the
*wiring*:

1. **Dashboard hero chart (`/dashboard`).** Hover the series' visible **peak** and
   its visible **trough** (not just the middle). The marker dot must sit centred on
   the line at both extremes — this is where the old bug was ±8px (3.64% of the
   220px chart) and where it was most visible. Then hover mid-range and confirm no
   regression there (the old and new formulas agree exactly at the midline, so a
   mid-range-only check proves nothing — check the extremes first). Switch ranges
   (e.g. 1M → 1Y) while hovering and confirm the marker still rides the animating
   line during the 500ms morph and the morph is not interrupted
   (`AGENT.md:29` / DESIGN.md:1261-1264 — the mousemove handler must still only
   read state, never touch `rafRef`).
2. **Research detail chart (`/research/<symbol>`, Overview tab, then Technical
   tab).** Same peak/trough hover check on the 190-tall chart, where the error was
   larger (4.21%). Confirm the tooltip card still sits above the dot with the same
   visible gap as before the change (the `- 4` standoff) and does not overlap it or
   fly off the top of the container when hovering a point near the plot ceiling
   (`Math.max(0, …)` clamp). Check both `period="1Y"` (Overview, 1300-wide) and
   `period="6M"` (Technical, 1000-wide) so both viewBox widths are exercised.
3. **Gridline non-regression.** On both charts confirm the y-axis labels and
   gridlines are unmoved from before the change — Task 1 refactors `gridlineYs`
   internally and a shifted gridline would mean the refactor changed behaviour it
   was not supposed to touch. The unmodified `gridlineYs` unit tests are the primary
   guard; this is the visual confirmation.

Reference lines cannot be manually verified: nothing passes `referenceLines` today
(TD-DTL-SR). Its correctness rests on the shared helper plus Task 2's unit tests.
Note this explicitly in the PR body rather than claiming it was visually checked.

## Assumptions

- The `- 4` in both tooltip `top` expressions is a percent-of-container standoff
  gap that composes with `translate(…, -100%)`, not a second copy of the domain
  mapping — so it needs no correction and is left byte-identical. (Read from the
  code at `portfolio-chart.tsx:255-261`; no comment states the intent explicitly,
  hence recorded here.)
- The reference-line fix is worth doing now despite having no live caller, because
  it is a second copy of the same wrong formula in the same file and AGENT.md:42
  scopes it to TD-33. If the owner prefers to leave dead-in-practice code alone,
  drop Task 4's reference-line half — the marker fix stands independently.
- `padding = 8` remains the shared value for both charts. The helper takes padding
  as a parameter so a future divergence is expressible, but this plan does not
  change either chart's constant.
- Closing TD-33 does not require touching TD-38 (the component-test-seam gap).
  TD-38 stays open and is the reason the Verification section carries manual checks.

## Open decisions (if any)

None.

## Proposed DECISIONS.md entry

```
## ADR-29 — `plotYFraction()` is the single value→y mapping for every element positioned against a chart series
- **Decision:** `lib/utils/chart-path.ts` exports `plotYFraction(value, domainMin, domainMax, height, padding = 8)`, returning the value's vertical position as a **fraction of chart height** on the same padded domain `buildPath` plots into (`padding + (1 - f) * (height - 2*padding)`, divided by `height`). `gridlineYs` becomes a thin wrapper (`ticks.map(v => plotYFraction(...) * height)`), and both charts' hover markers plus `DetailPriceChart`'s reference lines call it directly. A fraction (not SVG pixels) is returned because the consumers are split between CSS-percent HTML overlays (`* 100`) and SVG user units (`* height`) — the SVG is `preserveAspectRatio="none"`, so overlay geometry cannot live inside it.
- **Evidence:** [file:line — `lib/utils/chart-path.ts` `plotYFraction`/`gridlineYs`; `components/portfolio-chart.tsx` `hoverYFrac`; `components/research/detail-price-chart.tsx` `hoverYFrac` + reference-line `y`; `lib/utils/chart-path.test.ts` `describe("plotYFraction")` — fill in at implementation time]
- **Tradeoffs:** adds a fifth export to `chart-path.ts` and one more indirection inside `gridlineYs` (which previously inlined the formula), in exchange for making marker/gridline/line drift impossible by construction rather than by matching comments. Rejected alternative: calling `gridlineYs(min, max, h, p, [v])[0]` at each site — no new export, but allocates an array per hover/RAF frame on the app's hottest render path and reads as a misuse of a tick-positioning helper. Also rejected: returning SVG pixels and dividing by height at the CSS call sites (the pattern the existing gridline *labels* use) — a round-trip through pixels for a value never needed in pixels.
- **Status:** accepted
- **Confidence:** High — the mapping is unit-tested against `buildPath`'s own vertex pixels and cross-checked against `gridlineYs`; the pixel-level visual result is confirmable only by eye (TD-38: no component-render test seam).
```
