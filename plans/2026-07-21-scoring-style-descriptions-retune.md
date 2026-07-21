# Plan: scoring-style visible descriptions + maximize-distinction weight retune
Date: 2026-07-21

> Stacks on `plan/scoring-style-presets` (PR #24, ADR-23) — NOT on main. The
> preset code (`SCORING_STYLE_PRESETS`, `ScoringStylePreset` with a `blurb`
> field, `presetsForGroup`, the per-section picker in
> `app/(dashboard)/settings/page.tsx`) already exists on the working branch
> `feature/scoring-style-descriptions-retune`. This plan changes only DATA
> (preset weight numbers), COPY (blurbs), the picker's VISUAL treatment
> (Designer's call), tests, and an ADR. It does not touch scoring math, the
> API, the DB, or the normalize/fractions helpers.

> **Revised 2026-07-21** after owner review of the first draft. Three owner
> directives changed the retune materially (see "Owner decisions" below): the
> retune now targets **maximum inter-style distinction** (zeros allowed for
> noise/anti-diagnostic dimensions), Growth is **business-led** (fundamental +
> analyst), not price-momentum-led, and **all nine composite + all five
> style-defining fundamental groups are re-derived**, not just three. The
> visible-descriptions work and its functional spec are unchanged from the
> approved first draft.

## Owner decisions (recorded — do not re-litigate)

- **Maximize distinction, zeros allowed (the governing directive).** The styles
  must produce *visibly different* scores — sharp, clearly-differentiated
  presets, not a cluster of similar mid-range weightings. Push every style HARD
  toward its defining diagnostic signal and cut the noise dimensions
  aggressively. A dimension that is noise / anti-diagnostic for a style **may go
  to 0** — the `normalizeWeights` engine already supports this (a single
  non-zero weight → 1.0 for that dimension; a zeroed dimension is dropped
  entirely from that style's composite/fundamental score). Zeros are intended,
  not a bug.
- **Growth is business-led, not momentum-led.** Classic growth investing is
  about the BUSINESS compounding — revenue/earnings acceleration (the
  `fundamental` score, especially its `growth` subscore) plus analyst coverage —
  NOT primarily price action. `technical` is a *light confirm* for Growth, not a
  co-lead. This corrects the first draft, which leaned Growth toward price/news
  momentum and blurred it into the separate Momentum preset.
- **House default & Balanced stay UNTOUCHED (OD-1, resolved).** Leave
  `DEFAULT_SCORING_WEIGHTS` and the derived Balanced preset exactly as-is.
  Balanced stays `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`. Retuning the
  house default is out of scope — owner confirmed 2026-07-21.
- **Descriptions visible.** Each style's `blurb` is shown visibly under its
  label in the picker (not a `title`-only tooltip). Owner-approved in the first
  draft; unchanged.

## Problem

Two owner-approved changes to the scoring-style presets shipped in PR #24:

1. **Descriptions are hidden.** Each preset already carries a one-line `blurb`,
   but the picker surfaces it only as a native `title` tooltip — invisible on
   touch, on scan, and to most users. The owner wants each style's description
   shown **visibly beneath its label** in the picker, turning the bare pill row
   into a richer label+description list. The blurbs themselves are terse and
   were written to a persona framing ("what sounds like a value/growth
   investor") — they need a copy pass to state what each style *optimizes for*.

2. **The weights were derived from persona AND cluster around mid-range.** PR
   #24's preset weights answer "what would a Value / Growth / Momentum
   investor's slider look like?" — a persona framing — and they land in similar
   mid-range distributions that make the styles produce *similar* scores. Two
   problems compound:
   - **Persona, not diagnostics.** They do not answer the sharper question:
     *given how each of the five composite scores and five fundamental subscores
     is actually computed in THIS app, which signals genuinely distinguish a
     good pick for this style, and which are structurally biased or
     uninformative for it?* (`intrinsicValue` is DCF-anchored and reads
     structurally low for high-growth names — see "Grounding" — so a low IV
     score is the *thesis* for Value but *noise* for Growth/Momentum.)
   - **Not distinct enough.** Even with the right *direction*, small non-zero
     weights on noise dimensions blur the styles together. The owner's directive
     is to push each style hard toward its defining signal and zero out the
     noise, so applying different styles produces visibly different rankings.

The revised retune re-derives **all nine composite groups and all five
style-defining fundamental groups** to maximize inter-style separation, grounded
in how each score is computed.

## Grounding — how each score is actually computed (read before trusting any weight)

Read from the services on this branch; this is the evidence the retune rests on.

**Composite scores (0–10 each; consumed by `weightedCompositeTotal`):**

- **`intrinsicValue`** (`lib/services/intrinsic-value.service.ts`) — confidence-
  weighted average of five fair-value methods, all anchored to conservative
  multiples: DCF Lite **caps earnings growth at 15%**, applies a flat **10%
  discount rate**, and uses a **terminal P/E defaulting to ~15**; Graham Number
  (√(15·EPS·1.5·BookValue)); P/E-Multiple and P/B-Multiple against **industry
  averages that fall back to P/E 15 / P/B 1.5** (the `IndustryComparison` table
  is unpopulated — PRODUCT.md); PEG-Adjusted. The score is then upside vs.
  current price (`upsideToScore`). **Structural consequence:** a company trading
  at a 40+ P/E — any high-growth / tech name the market prices for reinvestment
  or optionality DCF Lite cannot capture — computes an intrinsic value far below
  price and thus a **low** score, almost regardless of business quality. The
  signal is **highly diagnostic for value/deep-value** (cheapness vs.
  fundamentals is the thesis) and **structurally anti-informative for
  growth/momentum/sentiment** (a low score there is a genre label, not a defect)
  → **zero it for those styles** under the maximize-distinction directive.

- **`fundamental`** (`lib/services/fundamental-analysis.service.ts`) — weighted
  blend of the five subscores below. Broadly informative for any
  quality-conscious style, and — critically — it is the signal that carries
  **business compounding** (via its `growth` subscore) and **durable quality**
  (via `profitability`). This is why the business-led styles (Quality, Growth)
  now *lead* with `fundamental`, not with price signals. Its internal
  **`valuation` subscore is growth-adjusted**: it prefers Forward P/E, PEG and
  P/FCF (each 1.5× weight) over trailing P/E, and PEG < 1 scores 9 — so a fast
  grower with earnings to match is *not* punished the way composite
  `intrinsicValue` is. This drives the fundamental-`valuation` decisions below.

- **`technical`** (`lib/services/technical-analysis.service.ts`) — points-
  weighted bull/bear signal from trend (SMA/EMA/golden cross), momentum
  (RSI/MACD/stochastic), volatility (Bollinger) and volume. Pure price-action;
  no valuation content. **Defining signal for momentum**; a *light confirm* for
  growth (business first, price second); **near-noise / anti-diagnostic for
  value/deep-value** (a contrarian pick is frequently technically weak *because*
  it is out of favour) → **zero it for value/deep-value/income**.

- **`sentiment`** (`lib/services/sentiment.service.ts`) — impact-weighted
  average of per-article Gemini sentiment (−1..1 → 0..10 via `sentimentToScore`).
  **Defining signal for the Sentiment style; strong for momentum; secondary for
  growth** (narrative corroborates a real grower). For **value/deep-value** it is
  at best neutral and arguably anti-diagnostic (bad news is often the entry
  point) → **zero it for value/deep-value**.

- **`analyst`** (`lib/services/analyst-ratings.service.ts`) — consensus of
  buy/hold/sell recommendations (StrongBuy 10 … StrongSell 0), **neutral 5 when
  there is no coverage**. A herding signal. **Defining signal for the Analyst
  Consensus style; strong for income** (well-covered mature payers) **and growth**
  (growth names are well-covered). **Low value for deep-value/contrarian** —
  consensus usually fights the contrarian thesis.

**Fundamental subscores (0–10 each; consumed by `weightedFundamentalTotal`):**
`valuation` (growth-adjusted, as above), `profitability` (ROE/margin/ROA),
`growth` (revenue + earnings growth), `financial` (current/quick ratio,
debt/equity), `dividend` (yield + payout; **defaults to 0 when no dividend** —
so a non-zero dividend weight on a non-payer drags that pick's fundamental score
down, which is exactly why non-income styles zero the dividend subscore).

## Approach

Re-derive **every** preset group under the maximize-distinction directive:
composite for all nine styles, fundamental for the five style-defining ones.
Each group is pushed hard toward its defining diagnostic signal, with noise /
anti-diagnostic dimensions cut to 0 where the grounding supports it. Every group
sums to **exactly 100**. Balanced stays derived and untouched. Rewrite the nine
blurbs to state what each style *optimizes for* (Growth's now emphasizes business
compounding, not price momentum). Change the picker so each option shows **label
+ always-visible description**. Update ADR-24 and the affected tests. No
scoring-math / API / DB / helper changes.

### Guiding diagnostic rules (applied consistently, sharpened)

1. **Push to the defining signal; zero the noise.** Each style leads hard with
   the one or two signals that genuinely diagnose it, and zeros dimensions that
   are noise or anti-diagnostic for it. This is what produces visibly different
   scores across styles (the owner's core directive). Zeros are valid — a
   100-sum group with zeros is fully supported by `normalizeWeights` and
   `sumsTo100`.
2. **`intrinsicValue` = 0 for growth/momentum/sentiment.** Structurally biased
   against high-multiple names → a low score there is a genre label, not a
   defect. Heavy only for value/deep-value, where cheapness-vs-DCF is the thesis.
3. **`fundamental` leads the business-quality styles.** Quality and Growth lead
   with `fundamental` (Growth via the growth subscore, Quality via
   profitability), NOT with price. `technical` is a *light confirm* for Growth.
4. **`technical` + `sentiment` are the momentum/flow signals.** They lead
   Momentum and Sentiment; they are zeroed for value/deep-value (out-of-favour
   is normal there, so price/news weakness must not disqualify).
5. **`analyst` is a herding signal.** Dominant for Analyst Consensus; strong for
   Income and Growth; cut for deep-value (consensus fights the thesis).
6. **Balanced is NOT retuned** — stays `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`
   = composite 25/25/20/15/15, fundamental 30/30/20/15/5. Owner-confirmed
   out of scope (OD-1, resolved).

### Proposed composite weights (percent; each row sums to 100 — verified)

`IV` = intrinsicValue, `Fund` = fundamental, `Tech` = technical, `Sent` =
sentiment, `Anly` = analyst.

| Style | IV | Fund | Tech | Sent | Anly | Diagnostic rationale (why this is the sharp allocation) |
|-------|----|----|----|----|----|----|
| **Value** | 45 | 35 | 0 | 0 | 20 | Cheapness-vs-DCF is the thesis → IV leads; fundamentals confirm quality; analyst gives a modest sanity check. Tech + Sent **zeroed** — out-of-favour price/news weakness is normal and anti-diagnostic for a value pick. |
| **Deep Value / Contrarian** | 55 | 30 | 0 | 0 | 15 | Even harder on IV (cheapness is the *whole* thesis) with fundamentals for survivability. Tech + Sent **zeroed** (bad news / weak chart is literally the entry setup). Analyst kept low, not zeroed, as a light coverage check. |
| **Quality (GARP)** | 15 | 55 | 5 | 5 | 20 | **Fundamentals dominate** (durable profitability = the thesis); analyst corroborates a quality large-cap; IV modest (GARP still wants a fair price, and the fundamental valuation subscore is growth-adjusted). Tech/Sent light confirms only. |
| **Growth** | 0 | 55 | 10 | 15 | 20 | **Business-led** (owner directive): `fundamental` leads (its growth subscore = revenue/earnings compounding, the actual thesis), analyst corroborates a covered grower, sentiment corroborates the narrative, tech is a *light confirm* only. IV **zeroed** — structurally biased against growth, pure noise here. This is the change that separates Growth from Momentum. |
| **Momentum** | 0 | 5 | 60 | 25 | 10 | **Price action dominates** — technical leads by a wide margin, sentiment corroborates flow. IV **zeroed** (noise); fundamentals near-floor (momentum barely cares). This is the price-led counterpart to Growth's business-led profile. |
| **Sentiment / News-driven** | 0 | 10 | 15 | 60 | 15 | **News sentiment dominates** the composite; technical + analyst are secondary flow confirms; a little fundamental sanity. IV **zeroed** (noise for a narrative-driven style). |
| **Analyst Consensus** | 5 | 15 | 5 | 15 | 60 | **Analyst rating dominates** — the defining signal by a wide margin; sentiment/fundamental corroborate; IV/tech near-floor. A consensus pick is a covered, fairly/richly-priced large cap, so IV is not distinguishing. |
| **Dividend / Income** | 15 | 40 | 0 | 5 | 40 | **Fundamentals (incl. dividend subscore) + analyst-corroborated stability co-lead**; IV modest (income buyers want a fair price; mature payers aren't DCF-penalised like growth names). Tech **zeroed** (income buyers don't chase charts); sentiment minimal. |
| **Balanced** | *derived* | | | | | NOT retuned — `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite)` = 25/25/20/15/15. OD-1 (resolved: out of scope). |

Every row verified to sum to exactly 100 (see Verification). Key separations the
sharp table now produces: **Value/Deep-Value** are the only IV-heavy styles and
the only ones zeroing tech+sent; **Growth** (Fund-led, IV=0) is now cleanly
distinct from **Momentum** (Tech-led, IV=0) — they no longer overlap; **Analyst
Consensus** and **Sentiment** each concentrate 60% on their single defining
signal.

### Proposed fundamental weights (percent; each row sums to 100 — verified)

`Val` = valuation, `Prof` = profitability, `Grw` = growth, `Fin` = financial,
`Div` = dividend. Only the five styles that define a fundamental group appear
(plus derived Balanced). **All five re-derived** under the maximize-distinction
directive — the first draft left these "unchanged"; they are now sharpened toward
each style's defining subscore with zeros on anti-diagnostic dimensions.

| Style | Val | Prof | Grw | Fin | Div | Diagnostic rationale (sharpened) |
|-------|----|----|----|----|----|----|
| **Value** | 55 | 20 | 0 | 20 | 5 | Valuation leads harder (was 45→**55**); balance-sheet safety (financial) co-anchors; profitability supports; **growth zeroed** (a value pick is not a grower — growth is anti-diagnostic); dividend token. |
| **Deep Value / Contrarian** | 65 | 15 | 0 | 20 | 0 | Max valuation (was 50→**65** — cheapness is everything) + financial health (survivability of a distressed name). **Growth AND dividend zeroed** — a distressed contrarian is defined by cheapness + survival, not growth or yield. |
| **Quality (GARP)** | 10 | 60 | 20 | 10 | 0 | **Profitability dominates** (was 45→**60** — durable returns are the quality thesis); growth meaningful; valuation light (the subscore is growth-adjusted, so quality-at-a-reasonable-price is already captured); **dividend zeroed** (quality ≠ payout). |
| **Growth** | 0 | 15 | 70 | 15 | 0 | **Growth subscore dominates** (was 55→**70** — revenue/earnings compounding IS the thesis, per the business-led directive); profitability + financial confirm the grower is real and solvent; **valuation AND dividend zeroed** (a growth investor leads with neither cheapness nor yield). |
| **Dividend / Income** | 10 | 20 | 0 | 15 | 55 | **Dividend subscore dominates** (was 30→**55** — yield + payout safety is the thesis); profitability + financial anchor payout sustainability; valuation light; **growth zeroed** (income ≠ growth). |
| **Balanced** | *derived* | | | | | NOT retuned — `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental)` = 30/30/20/15/5. OD-1 (resolved). |

Every row verified to sum to exactly 100. Note on the growth zeros: because the
fundamental `dividend` subscore **defaults to 0 for non-payers**, zeroing the
dividend weight for Growth/Quality/Deep-Value is doubly correct — it prevents a
non-payer's automatic 0 from dragging the score, and it sharpens the style.

### Fundamental `valuation` for growth — the IV insight does NOT transfer (decision, retained)

The composite `intrinsicValue` score is a *pure DCF-vs-price fair-value* number,
anchored to a 15% growth cap and ~15 P/E multiples — genuinely anti-growth by
construction, hence **zeroed** for Growth in the composite table. The fundamental
**`valuation` subscore is growth-adjusted** (prefers Forward P/E / PEG / P/FCF at
1.5×; PEG < 1 scores 9), so a fast grower whose earnings justify its multiple is
*not* structurally punished. Growth's fundamental-`valuation` weight going to
**0** is therefore a **style-fit** choice under the maximize-distinction
directive (a growth investor leads with the growth subscore, not valuation) —
NOT a bias-correction. Both roads reach 0, but the *reasoning* is recorded in the
ADR so a future reader does not "fix" it by conflating the two valuation signals.

### Visible descriptions (functional spec; visual is the Designer's)

Functional requirements the Designer stage must satisfy, constrained to existing
`DESIGN.md` tokens (no new colors, spacing, or type scales without adding a named
token to `DESIGN.md` first):

- Each preset option in the picker shows **its `label` AND its `blurb` as
  always-visible text** (not a `title`-only tooltip). This turns the current
  bare-pill row into a richer list/card of label + one-line description per
  option.
- The change remains **populate-only** (clicking still calls
  `setInputs(toInputs(preset[group]!))` — no `PUT`, no persisted state, no
  active/selected visual) and **still renders `presetsForGroup(group)`** in
  authorship order (nine on Composite, five on Fundamental — Momentum, Sentiment,
  Analyst Consensus stay composite-only).
- The `blurb` is now the primary description surface; the `title` attribute may
  be dropped or kept as redundant (Designer/Coding-agent's call) — it is no
  longer the sole affordance.
- Keyboard/a11y parity with the current pills (native `<button>`, Tab-reachable,
  Enter/Space, visible label as accessible name) must be preserved.
- The Designer updates the **"Style preset picker"** component entry and the
  **settings/loading.tsx** skeleton note in `DESIGN.md` to match the new
  label+description treatment (the current entry documents a bare pill with a
  `title`-only blurb — that becomes drift once this ships).

### Blurb copy (rewrite — state what the style OPTIMIZES FOR)

Proposed replacement blurbs (Designer/GTM may refine wording; keep them one line
each, diagnostic not persona). **Growth's blurb now emphasizes business
compounding, not price momentum**, matching the business-led retune:

- **value** — "Optimizes for stocks trading below DCF fair value with a safe balance sheet; ignores price and news."
- **deep-value** — "Maximizes cheapness vs. intrinsic value and balance-sheet survivability for distressed or contrarian names."
- **quality** — "Optimizes for durable profitability and steady growth at a still-reasonable price."
- **growth** — "Optimizes for accelerating revenue and earnings — the compounding business — with analyst coverage and a light price/news confirm; ignores DCF cheapness."
- **momentum** — "Optimizes for price trend and volume strength; fundamentals and valuation barely count."
- **sentiment** — "Optimizes for positive news-sentiment flow above all other signals."
- **analyst** — "Optimizes for Wall-Street consensus buy ratings, corroborated by news flow."
- **income** — "Optimizes for dividend strength and payout safety, backed by stable fundamentals and analyst coverage."
- **balanced** — "The house-default weighting — an even, all-signals starting point."

### UI consequence of zeros — no gate change needed (note for Coding agent + Reviewer)

Several sharpened groups now contain 0% dimensions (e.g. Growth composite
IV=0/Tech=... and Value fundamental Grw=0). A group containing zeros is still a
valid 100-sum group. The existing settings **Save gate** requires
`sumsTo100(group) && dirty` — `sumsTo100` checks only the sum, so a
zero-containing 100-sum group passes it unchanged. Applying such a preset
populates a field with `0`, which is a valid numeric input in the existing
percent inputs, and `normalizeWeights` correctly turns a single-non-zero /
zeroed-dimension group into a proper 1.0-summing fraction set (a zeroed
dimension drops out of that style's score — intended). **No gate, validation, or
input change is required.** This is called out so it is not flagged as a defect
in review.

## Tasks

1. [ ] Retune **all eight** style composite groups in `SCORING_STYLE_PRESETS`
   (`lib/utils/scoring-weights.ts`) to the "Proposed composite weights" table
   (value/deep-value/quality/growth/momentum/sentiment/analyst/income); Balanced
   stays derived and untouched. — Acceptance: `SCORING_STYLE_PRESETS` composite
   groups match the table exactly; `npx vitest run lib/utils/scoring-weights.test.ts`
   green (every group sums to 100, all keys present).
2. [ ] Retune **all five** style-defining fundamental groups
   (value/deep-value/quality/growth/income) to the "Proposed fundamental
   weights" table; Balanced fundamental stays derived and untouched. —
   Acceptance: fundamental groups match the table; the fundamental
   sum-to-100 / five-keys tests still pass; `balanced.fundamental` deep-equals
   `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental)`.
3. [ ] Rewrite all nine `blurb` strings to the "Blurb copy" list above (Growth's
   emphasizes business compounding). — Acceptance: each preset's `blurb` matches
   the new copy; TypeCheck passes (blurb stays a required `string`).
4. [ ] Change the picker in `app/(dashboard)/settings/page.tsx` to render each
   option as **label + always-visible `blurb`** per the functional spec, using
   the Designer's spec + existing `DESIGN.md` tokens. Keep populate-only
   behavior, `presetsForGroup` order, and keyboard/a11y parity.
   — Acceptance: manual — in the running app, each of the 9 composite / 5
   fundamental options shows its description under its label without hovering;
   clicking one populates the five fields (including any 0% fields) and flips the
   status line to valid; no `PUT` fires until Save.
5. [ ] Update `DESIGN.md`: the "Style preset picker" component entry and the
   `settings/loading.tsx` skeleton note, to describe label+description options
   instead of a bare `title`-tooltip pill. — Acceptance: `DESIGN.md` no longer
   claims the blurb is `title`-only; the skeleton note matches the new option
   shape. (Designer stage owns this; Coding agent verifies no residual drift.)
6. [ ] Update tests: the structural assertions in
   `lib/utils/scoring-weights.test.ts` (sum-to-100, five keys, nine ids,
   composite-only vs both-groups membership, Balanced-derived) all still pass
   unchanged — they assert structure, never specific numbers, so the retune is
   structurally safe. **Add focused value-lock assertions** pinning at least the
   groups that now contain zeros (Growth composite, Deep Value composite, Growth
   fundamental, Deep Value fundamental) to their new exact values, so a future
   accidental edit — or a well-meaning "presets shouldn't have zeros" change — is
   caught. — Acceptance: `npx vitest run` green; the new value-lock assertions
   reflect the retuned numbers and include at least one zero-containing group per
   group type.
7. [ ] Update **ADR-24** in `DECISIONS.md`: its rationale must record BOTH
   governing principles — (a) **maximize distinction between styles, zeros
   allowed for noise / anti-diagnostic dimensions**, and (b) **`intrinsicValue`
   is structurally biased against growth styles** (so it is zeroed, not merely
   reduced, for growth/momentum/sentiment) — plus the business-led Growth
   decision and the fundamental-`valuation`-is-growth-adjusted distinction (why
   Growth's fundamental valuation goes to 0 as a style-fit choice, not a
   bias-correction). Update its change list to the new numbers (all eight
   composite + all five fundamental groups re-derived). Reference ADR-23 as the
   thing it refines. — Acceptance: ADR-24 present in the ADR format, recording
   both principles and the new numbers; ADR-23's Status still cross-references
   ADR-24.

Work these in order. Tasks 1–3, 6, 7 are data/copy/test/doc (Coding agent);
Tasks 4–5 depend on the Designer stage's picker spec.

## Files to create or modify

- `lib/utils/scoring-weights.ts` — retune all eight style composite groups and
  all five style-defining fundamental groups; rewrite nine blurbs. (No type,
  helper, or Balanced-derivation change.)
- `lib/utils/scoring-weights.test.ts` — structural assertions unchanged and
  green; add value-lock assertions for the zero-containing groups.
- `app/(dashboard)/settings/page.tsx` — picker renders label + visible blurb.
- `DESIGN.md` — "Style preset picker" entry + `settings/loading.tsx` skeleton
  note updated for the label+description treatment.
- `DECISIONS.md` — update ADR-24 (both principles + new numbers); ADR-23's
  cross-reference stays.
- `ARCHITECTURE.md` — one-line touch on the `lib/utils/scoring-weights.ts`
  key-files row noting ADR-24 refined the preset values (if the row cites the
  old scope).

## Verification

The `## Verify` block in `AGENT.md` runs typecheck + lint + tests + secret scan.
Beyond it:

- **Sum-to-100 (automated):** every retuned group must still sum to exactly 100
  — locked by the existing `scoring-weights.test.ts` assertions; run
  `npx vitest run lib/utils/scoring-weights.test.ts` after Tasks 1–2. (All 13
  retuned rows were verified to sum to 100 at plan time: composite Value 45+35+0+0+20,
  Deep Value 55+30+0+0+15, Quality 15+55+5+5+20, Growth 0+55+10+15+20, Momentum
  0+5+60+25+10, Sentiment 0+10+15+60+15, Analyst 5+15+5+15+60, Income 15+40+0+5+40;
  fundamental Value 55+20+0+20+5, Deep Value 65+15+0+20+0, Quality 10+60+20+10+0,
  Growth 0+15+70+15+0, Income 10+20+0+15+55.)
- **Balanced untouched (automated):** the `balanced.composite` /
  `balanced.fundamental` deep-equals-`fractionsToPercents(DEFAULT...)` tests must
  stay green with **no edit** to Balanced — proves the house default was not
  retuned.
- **Zeros are accepted (automated + manual):** the value-lock tests include
  zero-containing groups and expect them to pass sum-to-100; manually confirm the
  settings Save gate enables when a zero-containing preset is applied (it does —
  `sumsTo100` checks only the sum).
- **Manual picker check:** in the running app's Settings → scoring weights, each
  preset option shows label + description visibly; applying **Growth** on
  Composite populates **0/55/10/15/20** (IV/Fund/Tech/Sent/Anly) and the status
  line reads valid; applying **Deep Value / Contrarian** populates
  **55/30/0/0/15**; applying **Growth** on Fundamental populates
  **0/15/70/15/0** (Val/Prof/Grw/Fin/Div); no
  `PUT /api/settings/scoring-weights` fires until Save is pressed.

## Assumptions

- The retuned numbers fix the *direction and magnitude* of each style's sharp
  tilt; the exact integers are the owner's to fine-tune later, carrying no
  structural risk as long as each group still sums to 100. The owner supplied the
  composite table as the calibration target and it is adopted as-is (the
  diagnostic grounding confirms every cell, including the business-led Growth and
  the zeros). The fundamental numbers are the plan's diagnostic sharpening of the
  same intent (the owner asked the Planner to derive these), and are equally
  tunable.
- The exact visual treatment of the richer label+description picker is the
  Designer's, bounded to existing `DESIGN.md` tokens; the plan fixes only the
  functional requirement (label + always-visible description, populate-only,
  `presetsForGroup` order, a11y parity).
- Blurb wording may be polished by the Designer/GTM stage; the plan fixes that
  each blurb states what the style *optimizes for*, one line, diagnostic, with
  Growth emphasizing business compounding.

## Open decisions

- **OD-1 — RESOLVED (out of scope, owner confirmed 2026-07-21).** The house
  default (`DEFAULT_SCORING_WEIGHTS`, composite 25/25/20/15/15) and the derived
  Balanced preset are left **untouched**. The diagnostic lens raises a fair
  question about whether the house default should itself down-weight the
  structurally-biased `intrinsicValue`, but that is a **separate, bigger change**
  — it alters the scores of every default-weights user and the meta-kicker
  baseline, touches the internal fraction scale, and needs its own
  migration-risk review. The owner confirmed it is out of scope for this plan;
  Balanced stays derived. No coding blocker.
