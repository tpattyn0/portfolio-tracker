# Review: Meridian research/asset detail views (7 tabs)
Date: 2026-07-18
Status:

## Summary
Findings: 0 BLOCKERs, 0 ISSUEs, 3 SUGGESTIONs, 1 QUESTION
Requires owner decision: MRD-Q1 (Overview verdict always uses wishlist-context labels)
Ready for Coding agent: MRD-S1, MRD-S2, MRD-S3 (all optional)

Reviewed branch `feature/meridian-research-detail` at HEAD (`3ff3ceef`), PR #14,
against the implementation of `plans/2026-07-18-meridian-research-detail.md`. Working
tree clean. `npm run verify` green: typecheck ok · lint ok (pre-existing warnings only)
· 66/66 tests · secret-scan clean.

This is a well-scoped, presentational-only re-skin. Every item on the task's scrutiny
list passes:

- **No fabricated data.** Every data-gap element renders a quiet em-dash / muted-italic
  placeholder — analyst Low/High targets (`analyst-ratings.tsx:126,141`), DCF Bear/Bull
  scenarios (`intrinsic-value.tsx:112,124`), FCF margin + terminal growth
  (`intrinsic-value.tsx:139-140`), revenue-by-segment empty state
  (`fundamental-analysis.tsx:239-241`), recent-revisions empty state
  (`analyst-ratings.tsx:148`), MoM sentiment delta omitted (`news-feed.tsx:121`),
  support/resistance lines omitted when absent (`detail-price-chart.tsx:137`). All 10
  gaps are logged as `TD-DTL-*` rows in `TECH_DEBT.md` (SECTOR, SR, PEER, SEG, TGT, REV,
  SCEN, ASSUMP, TONE, TXTYPE).
- **No hardcoded colors.** `rg 'hsl\(var\(|#[0-9a-fA-F]{3,8}|oklch\(|rgb\(' ` across all
  new/reskinned research components returns nothing. Everything routes through the
  Tailwind token aliases (`text-up`, `bg-fill`, `border-line2`, etc.) per ADR-8. The one
  arbitrary value — `hover:bg-[color:color-mix(in_srgb,var(--fill)_45%,transparent)]`
  (`news-feed.tsx:144`) — is built from the `--fill` token per DESIGN.md's 45%-fill hover
  rule, not a raw color.
- **No scoring-logic changes.** No `lib/services/*-analysis.service.ts` or
  `sentiment.service.ts` file is touched in the research-detail commits. Score banding
  (`score-band.ts`), grading dots (`metricGrade`), and figures recolor already-computed
  numbers only. `overview.tsx`'s composite math (weights, thresholds, derivations) is
  preserved verbatim.
- **DetailPriceChart correctness.** Hover pixel-mapping is computed from the container's
  measured `getBoundingClientRect().width` (`detail-price-chart.tsx:83-86,107`), correct
  under `preserveAspectRatio="none"`; `niceYTicks` degenerate cases are handled and unit-
  tested; `components/price-chart.tsx` is deleted with no remaining importer (grep confirms
  only `DetailPriceChart` is referenced), and Recharts is fully removed from all imports.
- **Test coverage.** All three new pure helpers ship `*.test.ts` files covering the
  required boundaries: `score-band.test.ts` asserts 6.9→amber, 7.0→up, 3.9→dn exactly;
  `chart-ticks.test.ts` covers the flat-series (`min===max`) and non-finite cases;
  `research-scores.test.ts` covers boundary + clamp + null cases.
- **`sentiment-score.tsx` disposition.** Correctly left in place — still imported by the
  out-of-scope `portfolio/[ticker]/page.tsx` position-detail page (TD-32), so retiring it
  would break that page. Matches the plan's Task-10 assumption.

Security pass (Step 1): no server-side surface changed (no API route, service, middleware,
or auth file in scope); no `dangerouslySetInnerHTML` / `eval` / `innerHTML` in the new
components; the fetch calls target existing authenticated routes that validate server-side.
Nothing to raise.

## Findings

### MRD-Q1 — QUESTION
**File:** `components/overview.tsx:166`, `app/(dashboard)/research/[symbol]/page.tsx:161-168`
**Problem:** The research-detail Overview tab hardcodes `context="wishlist"`, so the
composite verdict stamp always resolves to the wishlist label set (STRONG BUY / BUY /
WATCH / AVOID) even when the user actually holds the symbol — in which case the
portfolio label set (BUY MORE / HOLD / REDUCE / SELL) would be more accurate. The score
math is identical either way, so this is a copy/label choice, not a data problem, and it
is not a regression (the detail route is symbol-agnostic, so a single default is
reasonable). Flagging because the "right" default is a product call, not something the
Coding agent should decide silently.
**Recommendation:** Owner to confirm whether the Overview verdict should switch to
portfolio-context labels when the symbol is in the portfolio (would require the tab to
know ownership, e.g. reuse the TransactionsTab position query), or stay on the
wishlist label set as the intentional default. If the latter, no code change — close the
finding.

### MRD-S1 — SUGGESTION
**File:** `components/technical-analysis.tsx:64,84,92,100`
**Problem:** `currentPrice = data.chart[data.chart.length - 1]?.value` is `undefined` when
`data.chart` is empty, after which `currentPrice > indicators.sma20` evaluates to `false`
and the interpretation row silently reads "Price below short-term average" rather than a
neutral/unavailable state. Cosmetic (no fabricated number, no crash), and only reachable
if indicators exist while the chart series is empty — an unlikely API shape — but the
"below" wording is then misleading.
**Recommendation:** Guard the interpretation strings on `currentPrice != null` (fall back
to an em-dash or "n/a" reading) so an empty chart series doesn't imply a bearish reading.

### MRD-S2 — SUGGESTION
**File:** `components/detail-price-chart.tsx:106,138`
**Problem:** The reference-line y-fraction reuses `hoverValueRange` (`max - min || 1`),
a variable named for the hover marker, to position dashed support/resistance lines. The
math is correct, but the name obscures intent, and because reference-line values are not
clamped to `[min, max]`, a level outside the series range renders off the plotted area
(clipped by the SVG). Not exploitable and reference lines are unfed today (TD-DTL-SR), so
this is pre-emptive tidy-up.
**Recommendation:** Rename the shared denominator to something neutral (e.g. `valueRange`)
and, when reference lines are eventually fed real values (TD-DTL-SR), clamp or scale the
y-domain to include them so an out-of-range level stays visible.

### MRD-S3 — SUGGESTION
**File:** `components/analyst-ratings.tsx:85,110` vs `components/analyst-ratings.tsx:100`
**Problem:** The distribution bars scale off `totalRatings` (sum of the five buckets),
while the meta-kicker shows `ratings.totalAnalysts`. If the API's `totalAnalysts` ever
disagrees with the bucket sum (e.g. analysts with no rating bucket), the header count and
the bars describe different denominators. Presentational only, no fabrication.
**Recommendation:** Either derive the header count from the same `totalRatings` sum, or
add a one-line comment noting the two are expected to match so a future reader doesn't
treat the divergence as a bug.

## Proposed DECISIONS.md entries
None. ADR-11 was already appended and flipped to `accepted` with implemented evidence in
commit `ba8498c3`; it accurately describes the delivered `DetailPriceChart` +
`price-chart.tsx` retirement. No new architectural decision is introduced by this review.
