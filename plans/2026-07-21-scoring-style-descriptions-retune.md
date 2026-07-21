# Plan: scoring-style visible descriptions + signal-diagnostic weight retune
Date: 2026-07-21

> Stacks on `plan/scoring-style-presets` (PR #24, ADR-23) — NOT on main. The
> preset code (`SCORING_STYLE_PRESETS`, `ScoringStylePreset` with a `blurb`
> field, `presetsForGroup`, the per-section picker in
> `app/(dashboard)/settings/page.tsx`) already exists on the working branch
> `feature/scoring-style-descriptions-retune`. This plan changes only DATA
> (preset weight numbers), COPY (blurbs), the picker's VISUAL treatment
> (Designer's call), tests, and an ADR. It does not touch scoring math, the
> API, the DB, or the normalize/fractions helpers.

## Problem

Two owner-approved changes to the scoring-style presets shipped in PR #24:

1. **Descriptions are hidden.** Each preset already carries a one-line `blurb`,
   but the picker surfaces it only as a native `title` tooltip — invisible on
   touch, on scan, and to most users. The owner wants each style's description
   shown **visibly beneath its label** in the picker, turning the bare pill row
   into a richer label+description list. The blurbs themselves are terse and
   were written to a "what sounds like a value/growth investor" framing, not to
   "what this style optimizes for" — they need a copy pass.

2. **The weights were derived from persona, not diagnostics.** PR #24's preset
   weights answer "what would a Value / Growth / Momentum investor's slider
   look like?" — a persona framing. They do **not** answer the sharper
   question: *given how each of the five composite scores and five fundamental
   subscores is actually computed in THIS app, which signals genuinely
   distinguish a good pick for this style, and which are structurally biased or
   uninformative for it?* The owner's worked example: `intrinsicValue` is a
   DCF-anchored fair-value score that structurally reads **low** for
   high-growth / high-multiple companies (see "Grounding" below). A low
   intrinsic-value score is therefore the *thesis* for a Value investor (weight
   it heavily) but is *noise* for a Growth or Momentum investor — a low score
   there just says "this is a growth stock," so it should be **down-weighted**
   for those styles, not merely left small. The whole preset table needs
   re-deriving from this diagnostic lens.

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
  at a 40+ P/E — i.e. any high-growth / tech name the market prices for
  reinvestment or optionality DCF Lite cannot capture — computes an intrinsic
  value far below price and thus a **low** score, almost regardless of business
  quality. The signal is **highly diagnostic for value/contrarian** (cheapness
  vs. fundamentals is the thesis) and **structurally anti-informative for
  growth/momentum/sentiment** (a low score there is a genre label, not a defect).

- **`fundamental`** (`lib/services/fundamental-analysis.service.ts`) — weighted
  blend of the five subscores below. Broadly informative for any
  quality-conscious style. Note its internal **`valuation` subscore is
  growth-adjusted**: it prefers Forward P/E, PEG and P/FCF (each weighted 1.5×)
  over trailing P/E, and PEG < 1 scores 9 — so a fast grower with earnings to
  match is *not* automatically punished the way the composite `intrinsicValue`
  is. This distinction drives the fundamental-`valuation` decision below.

- **`technical`** (`lib/services/technical-analysis.service.ts`) — points-
  weighted bull/bear signal from trend (SMA/EMA/golden cross), momentum
  (RSI/MACD/stochastic), volatility (Bollinger) and volume. Pure price-action;
  no valuation content. **Diagnostic for momentum/growth**; near-**noise for
  deep value** (a contrarian pick is frequently technically weak *because* it is
  out of favour — over-weighting technical would screen out exactly the setups
  the style hunts).

- **`sentiment`** (`lib/services/sentiment.service.ts`) — impact-weighted
  average of per-article Gemini sentiment (−1..1 → 0..10 via `sentimentToScore`).
  **Diagnostic for sentiment/momentum/growth** (narrative-driven styles).
  For deep-value/contrarian it is at best neutral and arguably anti-diagnostic
  (bad news is often the entry point) — safest kept low, not elevated.

- **`analyst`** (`lib/services/analyst-ratings.service.ts`) — consensus of
  buy/hold/sell recommendations (StrongBuy 10 … StrongSell 0), **neutral 5 when
  there is no coverage**. A herding signal. **Diagnostic for
  consensus/growth/income** (well-covered large caps). **Low value for
  deep-value/contrarian** — consensus is usually *against* the contrarian
  thesis, so over-weighting it fights the style rather than confirming it.

**Fundamental subscores (0–10 each; consumed by `weightedFundamentalTotal`):**
`valuation` (growth-adjusted, as above), `profitability` (ROE/margin/ROA),
`growth` (revenue + earnings growth), `financial` (current/quick ratio,
debt/equity), `dividend` (yield + payout; defaults to 0 when no dividend).

## Approach

Re-derive every preset group (composite for all nine styles; fundamental for the
six that define it) from the diagnostic lens above, keeping each group summing to
**exactly 100**. Rewrite the nine blurbs to state what each style *optimizes
for*. Change the picker so each option shows **label + always-visible
description** (functional requirement; exact visual treatment is the Designer's,
constrained to existing `DESIGN.md` tokens). Update the ADR and the affected
tests. No scoring-math / API / DB / helper changes.

### Guiding diagnostic rules (applied consistently across styles)

1. **`intrinsicValue` is diagnostic only where cheapness-vs-DCF is the thesis.**
   Heavy for value/deep-value; **cut hard** for growth, momentum, sentiment
   (structural bias makes it noise, not signal) — this is the single biggest
   change from PR #24 and the reason for the whole retune.
2. **`technical` + `sentiment` are the momentum/flow signals.** Heavy for
   momentum/sentiment/growth; minimal for value/deep-value/income (out-of-favour
   is normal for these, so price/news weakness is not disqualifying).
3. **`analyst` is a herding signal.** Moderate default; **cut for
   deep-value/contrarian** (consensus fights the thesis); useful for
   consensus/income/growth.
4. **`fundamental` is broadly safe** — it is the least style-biased composite
   score, so it stays a meaningful anchor for every fundamentally-driven style
   and only recedes for the pure momentum/sentiment styles.
5. **Balanced is NOT retuned** — it stays derived from
   `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.*)`. Retuning it would mean
   changing the house default itself, a separate and bigger decision (see Open
   decisions OD-1).

### Proposed composite weights (percent; each row sums to 100)

`IV` = intrinsicValue, `Fund` = fundamental, `Tech` = technical, `Sent` =
sentiment, `Anly` = analyst. "Δ" column notes the material change(s) vs. PR #24
and the diagnostic reason.

| Style | IV | Fund | Tech | Sent | Anly | Diagnostic rationale for the change vs PR #24 |
|-------|----|----|----|----|----|----|
| **Value** | 40 | 35 | 5 | 5 | 15 | Unchanged. IV is the thesis (cheapness vs. DCF); fundamentals confirm quality; tech/sentiment near-noise for an out-of-favour pick; analyst kept modest — already diagnostically correct. |
| **Deep Value / Contrarian** | 50 | 30 | 5 | 5 | 10 | IV 45→**50** (cheapness is the whole thesis — max the one diagnostic signal); Sent 15→**5** and Anly 5→**10** rebalanced: PR #24 elevated *sentiment* to "catch turnarounds," but news sentiment is anti-diagnostic for a contrarian (bad news is the entry) — move that weight off sentiment; analyst stays low because consensus fights the thesis. |
| **Quality (GARP)** | 25 | 40 | 10 | 10 | 15 | Unchanged. Fundamentals lead; IV moderate (GARP still cares about a reasonable price, and the fundamental valuation subscore is growth-adjusted); balanced tails — already diagnostically sound. |
| **Growth** | 5 | 30 | 25 | 25 | 15 | IV 10→**5** (structurally biased against growth — near-noise, cut to the floor per the owner's core insight); Tech 20→**25** and Sent 20→**25** (price/narrative momentum is the diagnostic signal for growth); Fund held at 30 and Anly at 15 (fundamentals still confirm the grower is real, analysts cover growth names well). Net: weight moved off the biased IV signal onto the momentum signals. |
| **Momentum** | 5 | 10 | 45 | 25 | 15 | IV held at floor 5 (noise for momentum); Tech 45 and Sent 25 lead (the diagnostic signals); composite-only — unchanged from PR #24, already diagnostically correct. |
| **Sentiment / News-driven** | 5 | 15 | 25 | 40 | 15 | Unchanged. Sentiment leads; IV at floor (noise); composite-only — already correct. |
| **Analyst Consensus** | 10 | 20 | 10 | 20 | 40 | IV 15→**10** (a consensus pick is usually a covered, fairly/richly-priced large cap — IV is not the distinguishing signal, trim toward floor); Sent 15→**20** (news flow corroborates the consensus signal); analyst stays the dominant 40. |
| **Dividend / Income** | 20 | 30 | 5 | 10 | 35 | Unchanged. Fundamentals (incl. the dividend subscore) + analyst-corroborated stability lead; IV moderate (income buyers still want a fair price, and mature dividend payers are not structurally penalised by DCF the way growth names are); tech minimal — already diagnostically sound. |
| **Balanced** | *derived* | | | | | NOT retuned — `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite)` = 25/25/20/15/15. See OD-1. |

Material composite changes vs PR #24: **Deep Value** (Sent 15→5, IV 45→50, Anly
5→10), **Growth** (IV 10→5, Tech 20→25, Sent 20→25), **Analyst Consensus**
(IV 15→10, Sent 15→20). Value, Quality, Momentum, Sentiment, Income, Balanced
unchanged — the diagnostic lens confirms PR #24 already had them right.

### Proposed fundamental weights (percent; each row sums to 100)

`Val` = valuation, `Prof` = profitability, `Grw` = growth, `Fin` = financial,
`Div` = dividend. Only the six styles that define a fundamental group appear.

| Style | Val | Prof | Grw | Fin | Div | Diagnostic rationale for the change vs PR #24 |
|-------|----|----|----|----|----|----|
| **Value** | 45 | 25 | 5 | 20 | 5 | Unchanged. Cheapness + balance-sheet safety lead; growth subscore near-floor. Already correct. |
| **Deep Value / Contrarian** | 50 | 20 | 5 | 20 | 5 | Unchanged. Max valuation + financial health (survivability of the distressed name). Already correct. |
| **Quality (GARP)** | 15 | 45 | 20 | 15 | 5 | Unchanged. Profitability (durable returns) leads; growth meaningful; valuation modest (the subscore is growth-adjusted, so quality-at-a-reasonable-price is captured without over-weighting it). Already correct. |
| **Growth** | 5 | 20 | 55 | 15 | 5 | Unchanged — and deliberately so. See "Fundamental `valuation` for growth" below: 5% is already right, because the fundamental `valuation` subscore is growth-adjusted (unlike composite `intrinsicValue`), so the low weight is a *style-fit* choice (growth investors don't lead with cheapness), not a bias-correction. |
| **Dividend / Income** | 20 | 25 | 5 | 20 | 30 | Unchanged. Dividend subscore weighted highest; profitability/financial anchor payout safety; growth near-floor. Already correct. |
| **Balanced** | *derived* | | | | | NOT retuned — `fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental)` = 30/30/20/15/5. See OD-1. |

**Net fundamental result: no value changes from PR #24.** The diagnostic review
confirms the six fundamental groups were already diagnostically correct — the
fundamental subscores are individually less style-biased than the composite
`intrinsicValue` score (the growth-adjusted `valuation` subscore is the key
reason), so the persona-derived numbers happened to land right. This is a
finding, not an omission: the retune's teeth are in the **composite** table,
where the structurally-biased `intrinsicValue` signal lives. The fundamental
table is re-examined, documented, and left unchanged with reasons.

### Fundamental `valuation` for growth — does the IV insight apply? (decision)

**Question:** the owner asked whether the "intrinsic value is structurally
biased against growth" insight also means the fundamental **`valuation`
subscore** is biased against growth, implying Growth's 5% fundamental-valuation
weight is a bias-correction.

**Decision: No — the 5% is correct, but for a different reason, and it stays 5%.**
The composite `intrinsicValue` score is a *pure DCF-vs-price fair-value* number,
anchored to a growth cap of 15% and ~15 P/E multiples — genuinely
anti-growth by construction. The fundamental **`valuation` subscore is
growth-adjusted**: it prefers Forward P/E / PEG / P/FCF (1.5× weight) and awards
9 for PEG < 1, so a fast grower whose earnings justify its multiple is *not*
structurally punished. Therefore Growth's low fundamental-valuation weight (5%)
is a **style-fit** choice — a growth investor simply doesn't lead with valuation
— not a **bias-correction**. Both roads reach 5%, so no number changes; but the
*reasoning* is recorded in the ADR so a future reader doesn't "fix" it by
conflating the two valuation signals or bumping it thinking a bias needs
correcting.

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
  authorship order (nine on Composite, six on Fundamental).
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
each and diagnostic, not persona):

- **value** — "Optimizes for stocks trading below DCF fair value with solid, safe fundamentals."
- **deep-value** — "Maximizes cheapness vs. intrinsic value for distressed or contrarian turnarounds."
- **quality** — "Optimizes for durable profitability and growth at a still-reasonable price."
- **growth** — "Optimizes for revenue and earnings growth with price and news momentum; ignores DCF cheapness."
- **momentum** — "Optimizes for price trend and volume strength; fundamentals barely count."
- **sentiment** — "Optimizes for positive news-sentiment flow above all other signals."
- **analyst** — "Optimizes for Wall-Street consensus buy ratings, corroborated by news flow."
- **income** — "Optimizes for dividend strength and payout safety over price appreciation."
- **balanced** — "The house-default weighting — an even, all-signals starting point."

## Tasks

1. [ ] Retune the composite groups in `SCORING_STYLE_PRESETS`
   (`lib/utils/scoring-weights.ts`) to the "Proposed composite weights" table:
   change **deep-value**, **growth**, **analyst** composite groups; leave value,
   quality, momentum, sentiment, income unchanged; balanced stays derived.
   — Acceptance: `SCORING_STYLE_PRESETS` composite groups match the table;
   `npx vitest run lib/utils/scoring-weights.test.ts` green (every group still
   sums to 100).
2. [ ] Confirm the fundamental groups are unchanged and leave them as-is
   (no value edit) — this task is a documented no-op verifying the diagnostic
   review's conclusion. — Acceptance: fundamental groups byte-identical to PR
   #24; the fundamental-sum-to-100 test still passes.
3. [ ] Rewrite all nine `blurb` strings to the "Blurb copy" list above.
   — Acceptance: each preset's `blurb` matches the new copy; TypeCheck passes
   (blurb is still a required `string`).
4. [ ] Change the picker in `app/(dashboard)/settings/page.tsx` to render each
   option as **label + always-visible `blurb`** per the functional spec, using
   the Designer's spec + existing `DESIGN.md` tokens. Keep populate-only
   behavior, `presetsForGroup` order, and keyboard/a11y parity.
   — Acceptance: manual — in the running app, each of the 9 composite / 6
   fundamental options shows its description under its label without hovering;
   clicking one populates the five fields and flips the status line to valid;
   no `PUT` fires until Save.
5. [ ] Update `DESIGN.md`: the "Style preset picker" component entry and the
   `settings/loading.tsx` skeleton note, to describe label+description options
   instead of a bare `title`-tooltip pill. — Acceptance: `DESIGN.md` no longer
   claims the blurb is `title`-only; the skeleton note matches the new option
   shape. (Designer stage owns this; Coding agent verifies no residual drift.)
6. [ ] Update tests: the structural assertions in
   `lib/utils/scoring-weights.test.ts` (sum-to-100, five keys, nine ids,
   composite-only vs both-groups membership, balanced-derived) all still pass
   unchanged. **Audit for any test that hardcodes a specific pre-retune weight
   value** — none exists today (confirmed: the preset tests assert only
   structure, never specific numbers) — but if the Coding agent adds a
   value-specific assertion, it must use the new numbers. Optionally add a
   focused assertion locking the three changed composite groups
   (deep-value/growth/analyst) to their new values so a future accidental edit
   is caught. — Acceptance: `npx vitest run` green; if any value assertion is
   added it reflects the retuned numbers.
7. [ ] Add **ADR-24** to `DECISIONS.md` recording the signal-diagnostic retune
   rationale, the "intrinsic value is structurally biased for growth styles"
   principle, and the fundamental-`valuation`-is-growth-adjusted distinction
   (why Growth's 5% is style-fit, not bias-correction). Reference ADR-23 as the
   thing it refines (ADR-23 stays accepted; the weight *values* it shipped are
   superseded for deep-value/growth/analyst). — Acceptance: ADR-24 present in
   the ADR format; ADR-23's Evidence/Status cross-references ADR-24 for the
   changed values.

Work these in order. Tasks 1–3, 6, 7 are data/copy/test/doc (Coding agent);
Task 4–5 depend on the Designer stage's picker spec.

## Files to create or modify

- `lib/utils/scoring-weights.ts` — retune deep-value/growth/analyst composite
  groups; rewrite nine blurbs. (No type, helper, or fundamental-value change.)
- `lib/utils/scoring-weights.test.ts` — verify structural assertions still pass;
  optional value-lock for the three changed groups.
- `app/(dashboard)/settings/page.tsx` — picker renders label + visible blurb.
- `DESIGN.md` — "Style preset picker" entry + `settings/loading.tsx` skeleton
  note updated for the label+description treatment.
- `DECISIONS.md` — add ADR-24; cross-reference from ADR-23.
- `ARCHITECTURE.md` — update the `lib/utils/scoring-weights.ts` key-files row's
  ADR-23 clause to note ADR-24 refined the preset values (one-line touch only).

## Verification

The `## Verify` block in `AGENT.md` runs typecheck + lint + tests + secret scan.
Beyond it:

- **Sum-to-100 (automated):** every retuned group must still sum to exactly 100
  — locked by the existing `scoring-weights.test.ts` assertions; run
  `npx vitest run lib/utils/scoring-weights.test.ts` after Task 1.
- **Balanced untouched (automated):** the `balanced.composite` /
  `balanced.fundamental` deep-equals-`fractionsToPercents(DEFAULT...)` tests must
  stay green with no edit — proves Balanced was not retuned.
- **Manual picker check:** in the running app's Settings → scoring weights, each
  preset option shows label + description visibly; applying **Growth** on
  Composite populates 5/30/25/25/15 (IV/Fund/Tech/Sent/Anly) and the status line
  reads valid; applying **Deep Value / Contrarian** populates 50/30/5/5/10; no
  `PUT /api/settings/scoring-weights` fires until Save is pressed.

## Assumptions

- The retuned composite numbers are the owner's to fine-tune later; the plan
  fixes the *direction and magnitude* of each diagnostic change, not sacred
  exact integers — a future one-line nudge to any group carries no structural
  risk (same as ADR-23's note on the Dividend/Income numbers). Each group must
  still sum to 100.
- The fundamental groups are left byte-identical because the diagnostic review
  found them already correct (the fundamental subscores are less style-biased
  than the composite `intrinsicValue`); this is a deliberate conclusion, not an
  un-done task.
- The exact visual treatment of the richer label+description picker is the
  Designer's, bounded to existing `DESIGN.md` tokens; the plan fixes only the
  functional requirement (label + always-visible description, populate-only,
  `presetsForGroup` order, a11y parity).
- Blurb wording may be polished by the Designer/GTM stage; the plan fixes that
  each blurb states what the style *optimizes for*, one line, diagnostic.

## Open decisions

- **OD-1 — Balanced / house default is out of scope.** The diagnostic lens
  raises a fair question about the *house default itself*
  (`DEFAULT_SCORING_WEIGHTS`, composite 25/25/20/15/15): it weights the
  structurally-biased `intrinsicValue` at 25%, the same as `fundamental`. If a
  future owner decision holds that the default should down-weight
  `intrinsicValue` on the same diagnostic grounds, that is a **separate, bigger
  change** — it alters the scores of *every* user with default weights and the
  meta-kicker "your weighting" comparison baseline, touches
  `DEFAULT_SCORING_WEIGHTS` (fractions, the internal scoring scale), and needs
  its own migration-risk review. **This plan explicitly does NOT change it**;
  Balanced stays derived. Flagged here so the owner can decide separately
  whether to open that follow-up. No coding blocker — this plan proceeds with
  Balanced untouched.
