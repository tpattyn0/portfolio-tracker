# Review: TD-33 — hover-marker padded-domain alignment (`plotYFraction`)
Date: 2026-07-23
Status:

## Summary
Findings: [0 BLOCKERs, 0 ISSUEs, 2 SUGGESTIONs, 1 QUESTION]
Requires owner decision: TD33-Q1 (flat-series hover-marker convention change — confirm intended; low reachability)
Ready for Coding agent: TD33-S1, TD33-S2

Scope reviewed: `git diff main...HEAD` on `feature/td33-hover-marker-padded-domain`
(branch HEAD `7fc46140`, base `main` at `2f1e376f`), PR #35, implementing
`plans/2026-07-23-td33-hover-marker-padded-domain.md`.

Verdict: **the fix is correct, not merely different.** I derived the mapping
independently rather than reading it for plausibility, and mutation-tested the new
test block rather than trusting the Coding agent's claim. Both hold up. The single
QUESTION is a pre-existing convention inconsistency this change inherits and
slightly re-scopes — it is not a defect introduced by the diff, and the new
behavior is arguably the better of the two.

### Security pass (Step 1)
Run in the prior session and treated as done per the orchestrator's instruction;
not re-run. Its conclusion, recorded here: the diff is a purely presentational
geometry change confined to two inline-SVG chart components and one pure math
helper in `lib/utils/chart-path.ts`. It introduces no new endpoint, no auth or
permission surface, no credential handling, no user-controlled string reaching a
sensitive sink (no `dangerouslySetInnerHTML`, no query construction, no `eval`),
and no destructive or persisted-data operation. `plotYFraction` is a pure
arithmetic function over numbers already in client state. Values flow only into
SVG geometry attributes and CSS `top`/`left` percentages, which are not injection
surfaces. No vulnerabilities found; nothing to fold into the findings below. The
Verify block's gitleaks step passes clean (`no leaks found`, ~3.07 MB scanned).

## Findings

### TD33-C1 — CORRECTNESS CONFIRMED (no action)
**File:** `lib/utils/chart-path.ts:171-186`, `:209-217`

I derived the mapping independently instead of pattern-matching the diff. The
required identity is that `plotYFraction(v, …) * height` reproduce `gridlineYs`'s
prior pixel mapping `padding + (1 - (v-min)/range) * (height - 2*padding)` exactly.

Verified numerically over 8,000 randomized cases spanning four
`(height, padding)` geometries — `(220,8)`, `(190,8)`, `(100,0)`, `(220,20)` — with
values deliberately sampled **outside** `[min,max]` (range `-0.3` to `1.3` of the
domain) as well as inside:

```
max |plotYFraction(v)*height − oldGridlineFormula(v)| = 2.84e-14
```

That is floating-point noise, not a behavioral delta. The refactor is
algebraically exact.

**Degenerate `range === 0`:** returns `mid / height` where
`mid = padding + (height - 2*padding)/2`. Confirmed to yield exactly `0.5` for
`(220,8)` and `95px` for `(190,8)` — the true vertical midpoint. The explicit
branch (rather than a `|| 1` guard) mirrors `gridlineYs`'s prior structure exactly,
so those two cannot diverge. See TD33-Q1 for the one place this convention does
*not* match.

**Out-of-domain values:** `plotYFraction` extrapolates linearly and does **not**
clamp — e.g. `v=120` on domain `[0,100]`, height 220 returns `-32.8px` (above the
plot top). This is correct and safe for every current caller:
- the reference line clamps to the true `[min,max]` *before* calling
  (`detail-price-chart.tsx:181`), and `[min,max]` is always strictly inside the
  margined `[domainMin,domainMax]`;
- both hover paths derive their value from the plotted series itself
  (`hoverValue` from `animatedValues`, `hoverPoint.value` from `points`), so the
  value is by construction within the series' own min/max, hence within the
  margined domain.

There is no reachable un-clamped out-of-domain call site today. Worth knowing if a
future annotation caller passes an arbitrary user-supplied level — noted as
TD33-S2.

**Error magnitude reproduces the ticket exactly.** The old naive formula's error is
`padding/height * (1 - 2f)`, maximal at the extremes:
`8/220 = 3.636%` (hero) and `8/190 = 4.211%` (detail) of chart height — matching
TD-33's and ADR-29's stated `~3.64%` / `~4.21%`, and confirming it is exactly zero
at `f = 0.5`.

### TD33-C2 — MUTATION TEST VERIFIED (no action)
**File:** `lib/utils/chart-path.test.ts:123-201`

This was the highest-value check, because the error being fixed vanishes at the
midpoint — a midpoint-only test suite would pass against the buggy formula and
provide false assurance. I did not take the Coding agent's word for it.

I reverted the helper body in place to the naive
`return 1 - (value - domainMin) / range;`, ran the suite, then restored the file
byte-identically (confirmed via empty `git status --porcelain`; no application
code was modified by this review).

Result: **6 of the new tests fail against the mutant**, including the two that
matter most:
- `"is NOT the naive un-padded fraction at the extremes (the regression this closes)"`
  — fails with `expected +0 to be close to 0.03636…`, i.e. it catches the exact
  padding omission;
- `"is not hardcoded to the hero chart's 220-tall geometry (the detail chart's 190-tall case)"`
  — fails with `expected +0 to be close to 8`.

The tests have the required property: they assert at the extremes and genuinely
fail on reversion. The midpoint test (`toBeCloseTo(0.5, 10)`) is correctly present
as a *guard against an off-by-padding in the other direction*, not as the primary
assertion.

One immaterial discrepancy: ADR-29's Confidence field and the Coding agent's
report both claim **8** failing tests; the actual count is **6**. The substantive
claim is sound, the number is not. Flagged as TD33-S1 — a documentation accuracy
fix, not a correctness problem.

**`gridlineYs` behavior preservation confirmed:** all 21 pre-existing
`gridlineYs`/`buildPath` tests pass unmodified. The test-file diff deletes exactly
2 lines, both benign (the import line, extended to add `plotYFraction`, and the
file-header line) — no existing assertion was altered, loosened, or removed. Under
the mutant run, the pre-existing tests still passed while only the new block
failed, independently proving gridline positioning is untouched to the subpixel.

### TD33-C3 — NO DOUBLE-APPLICATION OF THE DOMAIN MARGIN (no action)
**File:** `components/portfolio-chart.tsx:162`, `components/research/detail-price-chart.tsx:82`

Confirmed. Both components still derive the domain via the shared
`marginDomain(min, max, CHART_DOMAIN_MARGIN)` exactly once, and the diff touches
**no** `marginDomain` / `CHART_DOMAIN_MARGIN` line other than the import
statements. `plotYFraction` receives that already-margined `domainMin`/`domainMax`
and applies only the padding term — the margin is applied once, in the same place
as before. `buildPath` continues to receive the raw values plus
`CHART_DOMAIN_MARGIN` and margins internally, unchanged. No double-margining, and
the ADR-27/AGENT.md invariant that both components share one `marginDomain()` call
still holds.

### TD33-C4 — TOOLTIP `- 4` OFFSET INTACT AND COMPOSES CORRECTLY (no action)
**File:** `components/portfolio-chart.tsx:263,269`, `components/research/detail-price-chart.tsx:211,217`

Byte-identical in both files — `git diff main...HEAD -- components/` contains no
added or removed line matching `- 4`. Composition sanity-checked: the marker sits
at `top: ${hoverYFrac * 100}%` and the tooltip at
`Math.max(0, hoverYFrac * 100 - 4)%` with `translate(…, -100%)`. Both read the
*same* corrected `hoverYFrac`, so the 4-percentage-point standoff is preserved as
a constant relative gap; the correction shifts marker and tooltip together rather
than changing their separation. The `-4` is a percent-of-container standoff, not a
domain term, so it correctly required no adjustment. The `Math.max(0, …)` clamp
still protects the top edge, and since the corrected `hoverYFrac` is now bounded
by `[padding/height, 1 - padding/height]` (≈`[0.036, 0.964]`) rather than
`[0, 1]`, the tooltip is marginally *less* likely to hit that clamp than before —
a small improvement, no regression.

### TD33-C5 — ADR-29 AND AGENT.md CITATIONS ALL RESOLVE (no action)
**File:** `DECISIONS.md:217` (ADR-29), `AGENT.md:42`

This defect class has recurred three sessions running, so I resolved **every**
citation individually against HEAD rather than spot-checking. All 12 ADR-29
citations resolve to the claimed construct:

| Citation | Resolves to | OK |
|---|---|---|
| `chart-path.ts:171-186` | `plotYFraction` definition, exactly spanning those lines | yes |
| `chart-path.ts:209-217` | `gridlineYs` wrapper, exact `ticks.map(...)` body as quoted | yes |
| `portfolio-chart.tsx:12` | `plotYFraction,` import member | yes |
| `portfolio-chart.tsx:182-183` | `hoverYFrac` assignment, matches quoted text | yes |
| `portfolio-chart.tsx:263` / `:269` | `hoverYFrac * 100` / `Math.max(0, hoverYFrac * 100 - 4)` | yes |
| `detail-price-chart.tsx:12` | `plotYFraction,` import member | yes |
| `detail-price-chart.tsx:140-142` | `hoverYFrac` ternary (full 3-line span) | yes |
| `detail-price-chart.tsx:181` | `clampedValue` clamp, unchanged as claimed | yes |
| `detail-price-chart.tsx:182` | reference-line `y = plotYFraction(...) * CHART_HEIGHT` | yes |
| `detail-price-chart.tsx:211` / `:217` | tooltip consumers, unchanged | yes |
| `chart-path.test.ts:123-201` | `describe("plotYFraction")` opens at 123, closes at 201 | yes |

The `123-201` range is exact — line 123 is `describe("plotYFraction", () => {` and
line 201 is its closing `});`.

AGENT.md's TD-33 citations also resolve: `portfolio-chart.tsx:182-183` and
`detail-price-chart.tsx:182` are exact. `detail-price-chart.tsx:140-141` is
very slightly narrow — the `hoverYFrac` ternary actually spans `140-142` (line 142
is the `: 0;` tail), which ADR-29 itself cites correctly as `:140-142`. This is a
one-line under-count on a multi-line expression, not a citation pointing at the
wrong construct; noted in TD33-S1 for tidiness only. **No stale or wrong-construct
citation found — the recurring drift did not recur this session.**

### TD33-Q1 — QUESTION
**File:** `lib/utils/chart-path.ts:106` (`buildPath`) vs `:181-184` (`plotYFraction`)
**Problem:** `buildPath` and `plotYFraction` disagree on where a **perfectly flat
series** is drawn, and this change moves the hover marker from one convention to
the other.

`buildPath` guards zero range with `const range = domainMax - domainMin || 1`
(`:106`), so for a flat series it plots every point at
`padding + (1 - 0/1) * (height - 2*padding)` = the plot **bottom** (`212px` at
height 220). `plotYFraction` takes the explicit zero-range branch and returns the
**midpoint** (`110px`). That is a **102px / 46.4%-of-height** divergence: on a flat
series the line renders along the floor while the hover marker sits mid-chart.

Important framing — this is **not a regression introduced by this diff**, and the
diff is not wrong to inherit it:
- the midpoint convention is pre-existing; `gridlineYs` on `main` already had the
  identical explicit `range === 0 → mid` branch, so gridlines have always drawn
  mid-chart on a flat series while `buildPath` drew the line at the floor;
- `plotYFraction` faithfully preserves `gridlineYs`'s documented behavior, which
  is exactly what ADR-29 promises;
- what *did* change is the **hover marker**: on `main` it used
  `domainMax - domainMin || 1`, matching `buildPath` (bottom); it now follows the
  midpoint branch. So on a flat series the marker moved from "on the line" to
  "on the gridlines."

Reachability is genuine but rare: `marginDomain` explicitly preserves zero range
(`range === 0` returns `[min, max]` unmodified), so a flat series propagates
intact. It requires every plotted point to be bit-identical — a portfolio whose
value never moved across the window, or a single-point/halted-ticker series.

Neither convention is self-evidently right, which is why this is a QUESTION rather
than an ISSUE: aligning the marker to the *line* (bottom) versus to the
*gridlines/labels* (midpoint) is a design call, and the new behavior is arguably
the better one — a flat series drawn flush against the floor is itself the odder
rendering, and the marker now agrees with the y-axis labels the user is reading.
I am flagging it because the change is silent, undocumented, and this review is
the only place it has been noticed.

**Recommendation:** owner decision, one of:
(a) accept the new midpoint behavior and record it — add one sentence to ADR-29's
Tradeoffs noting the hover marker's flat-series position changed from plot-bottom
to midpoint, matching gridlines rather than `buildPath`; **or**
(b) treat `buildPath`'s `|| 1` as the odd one out and open a TECH_DEBT item to
reconcile it onto the explicit midpoint branch, so line, marker, and gridlines all
agree on a flat series.

Option (a) is the smaller, lower-risk change and is consistent with ADR-29's stated
goal. Option (b) touches `buildPath`, which is covered by the dip-clipping
regression block — it should not be done casually, and not in this PR.

### TD33-S1 — SUGGESTION
**File:** `DECISIONS.md:217` (ADR-29 Confidence field); `AGENT.md:42`
**Problem:** Two small documentation inaccuracies. (1) ADR-29's Confidence field
states the revert-and-confirm check makes "8 of the new tests fail"; the actual
count is **6** (verified by performing the mutation myself). The claim's substance
is correct — the tests do fail on reversion, which is the point — but the figure
is wrong, and an ADR that overstates its own evidence is the same class of drift
this project has been tightening up on. (2) AGENT.md cites
`detail-price-chart.tsx`'s `hoverYFrac` at `:140-141` where the expression spans
`:140-142` (ADR-29 gets this right).
**Recommendation:** In `DECISIONS.md`, change "makes 8 of the new tests fail" to
"makes 6 of the new tests fail". In `AGENT.md:42`, change the
`detail-price-chart.tsx`'s `hoverYFrac` at `:140-141` citation to `:140-142`.
Doc-only; no code or test change.

### TD33-S2 — SUGGESTION
**File:** `lib/utils/chart-path.ts:110` (inside `buildPath`)
**Problem:** ADR-29 states the padded-domain formula "lives in exactly one place"
and that drift is "no longer possible by construction." That is now true of the
marker, reference line, and gridlines, but **not** of `buildPath` itself, which
still inlines its own copy at `:110`:
`y: padding + (1 - (v - domainMin) / range) * (height - 2 * padding)`.
`buildPath` is the very reference every other element is meant to register
against, so it is the one remaining place where an edit could silently desynchronize
the line from everything positioned against it — precisely the failure mode TD-33
existed to close. The two copies agree today (verified numerically above); the
residual is structural, not behavioral. Note the shapes are not trivially
interchangeable: `buildPath` needs a pixel `y` per point and uses the `|| 1`
zero-range guard (see TD33-Q1), so this is a real refactor with a behavior decision
attached, not a mechanical substitution — hence a SUGGESTION, and one that should
follow TD33-Q1's resolution rather than precede it.
**Recommendation:** Either (a) refactor `buildPath`'s point mapping onto
`plotYFraction` (`y: plotYFraction(v, domainMin, domainMax, height, padding) * height`),
resolving the zero-range convention per TD33-Q1 first and re-running the
dip-clipping regression block in `chart-path.test.ts`; or (b) if that is judged
out of scope, soften ADR-29's "exactly one place" wording to name `buildPath`'s
inline copy as a known remaining duplicate, and add a TECH_DEBT row for it. Do not
leave the ADR claiming a single-source-of-truth that the file does not yet have.

## Standing checklist

| Item | Result |
|---|---|
| Working tree clean | **Pass** — `git status --porcelain` empty at review start and after my mutation test was reverted. Note: the orchestrator's in-flight `STATUS.md` was already committed (`7fc46140`), so the tree was fully clean, not even the permitted carve-out. |
| Branch / remote state | **Pass** — verified live after `git fetch --prune`. On `feature/td33-hover-marker-padded-domain`, `git pull --ff-only` reports "Already up to date", `git log @{u}..` empty (nothing unpushed). Branch is present on the remote (not `[gone]`). |
| STATUS.md within limits | **Pass** — 12 lines, links only, standard `## In progress` / `## Blocked` sections, no narrative prose. The two `Blocked` entries (TD-01, TD-02) are pre-existing owner-accepted items with one-line reasons. |
| File structures conform | **Pass** — ADR-29 carries all five required fields (Decision / Evidence / Tradeoffs / Status / Confidence). `TECH_DEBT.md` Backlog and Resolved tables both keep their headers; TD-33's Resolved row (`:61`) is well-formed with a date. `plans/INDEX.md` row for this plan reads `in review` — correct, since the review is not yet `IMPLEMENTED`. |
| Secrets | **Pass** — gitleaks clean (`no leaks found`, ~3.07 MB). `.env` variants and `scratch/` gitignored (`.gitignore:21-25,59,62`). No credential-shaped literal anywhere in the diff, which is pure chart math. |
| Verify block present and passing | **Pass** — `AGENT.md:60-68` defines the single `npm run verify`. Ran it in full: typecheck ok, lint ok (pre-existing warnings only, none in changed files), **282/282 tests across 35 files**, secret-scan ok. |

### Doc drift and test coverage

- **No drift found.** ADR-29 and the AGENT.md TD-33 paragraph accurately describe
  the implemented behavior, including the subtle points (fraction-not-pixels return
  shape and why; the `-4` term being an independent standoff; the `[min,max]` clamp
  staying on the true domain). TECH_DEBT TD-33 is correctly moved to Resolved with
  a date and links to both the plan and ADR-29. The only inaccuracies are the two
  small ones in TD33-S1.
- **Test coverage is adequate and meaningful.** The one new exported function has 7
  new tests: extremes registration against `buildPath`'s own vertex pixels, a
  direct cross-check against `gridlineYs` over 5 values, the explicit
  anti-naive-formula assertion, the midpoint guard, flat-series (no NaN/Infinity,
  matches `gridlineYs`), a non-220 geometry case, and default-padding. Happy path
  and meaningful failure/edge cases are both covered, and the mutation test proves
  the coverage is real rather than nominal.
- **Not re-flagged, per scope:** TD-38 (no component-render test seam, so the
  pixel-level visual result cannot be asserted in tests) and TD-DTL-SR (reference
  line has no live caller) are both open, correctly documented, and unchanged in
  severity by this diff.
- **Plan task 6** is correctly marked `[!]` blocked-on-owner for the manual visual
  check, with the reason recorded inline — the honest marker, not a false `[x]`.

## Proposed DECISIONS.md entries

None. ADR-29 already covers this change and is accurate as written, apart from the
test-count correction in TD33-S1.

If the owner chooses TD33-Q1 option (a), no new ADR is needed — one sentence
appended to ADR-29's **Tradeoffs**, suggested wording:

> The hover marker's flat-series (`domainMax === domainMin`) position changes as a
> side effect: it previously used `range || 1` (matching `buildPath`, which draws a
> flat series at the plot floor) and now takes `plotYFraction`'s explicit
> zero-range branch, placing it at the vertical midpoint alongside the gridlines
> and y-axis labels. `buildPath` itself is unchanged and still floors a flat
> series, so line and marker diverge in that degenerate case; aligning the marker
> with the labelled gridlines was judged the more useful of the two, and a flat
> series is rare enough that the residual mismatch is accepted rather than fixed in
> `buildPath` (which is covered by the dip-clipping regression block).

If the owner chooses option (b), the reconciliation of `buildPath`'s `|| 1` guard
belongs in a TECH_DEBT row plus a Planner-scoped task, not a new ADR.
