# Review: Meridian research/asset detail views (7 tabs)
Date: 2026-07-18
Status: IMPLEMENTED — 2026-07-18

## Summary
Findings (iteration 1): 0 BLOCKERs, 0 ISSUEs, 3 SUGGESTIONs, 1 QUESTION — all resolved in the fix pass (`1c524c0a`).
Findings (iteration 2 re-review): 0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 0 QUESTIONs.
Requires owner decision: none (MRD-Q1 answered in code — Overview verdict is now context-aware).
Ready for Coding agent: none remaining.
(See the "Iteration 2 — fix-pass re-review" section at the bottom for verification detail.)

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

---

## Iteration 2 — fix-pass re-review (2026-07-18)

Re-reviewed branch `feature/meridian-research-detail` at HEAD (`74f41142`), PR #14,
after the Coding agent fix pass (`1c524c0a`) that acted on all four iteration-1 findings.
Working tree clean. `npm run verify` green: typecheck ok · lint ok (pre-existing warnings
only) · **69/69 tests** (was 66 — the 3 new `verdictLabel` tests) · secret-scan clean.

**Result: all four prior findings resolved. 0 new BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs,
0 QUESTIONs.** MRD-Q1 (the only owner-decision item) is answered in code — the Overview
verdict is now context-aware rather than hardcoded — so nothing remains awaiting owner input.

### Verification of each fix

- **MRD-Q1 — RESOLVED.** `app/(dashboard)/research/[symbol]/page.tsx:61-73` adds a
  `useQuery(["position", symbol])` ownership lookup whose `queryFn` mirrors
  `components/research/transactions-tab.tsx:35-40` exactly (fetch
  `/api/portfolio/positions/${symbol}`; `404 → null`; `!ok → throw`). Because both call
  sites use the **identical query key** `["position", symbol]`, React Query dedupes them
  into one shared cache entry — no double fetch, consistent ownership signal across the
  Overview and Transactions tabs. `overviewContext = positionQ.data ? "portfolio" :
  "wishlist"` defaults to `"wishlist"` while loading and when not held (the previous
  hardcoded default), and flips to `"portfolio"` only when a position exists — no console
  error or uncaught rejection on the 404 path (it resolves to `null`, not a throw).
  - **Label selection correct.** The inline if/else in `overview.tsx` was replaced by the
    extracted pure `verdictLabel(score, context)` (`lib/utils/research-scores.ts:39-50`)
    using the *same* boundaries the composite has always used (≥8.5 / ≥7.0 / ≥5.0):
    portfolio → BUY MORE / HOLD / REDUCE / SELL; wishlist → STRONG BUY / BUY / WATCH /
    AVOID. The dead `.replace(/_/g, " ")` on the old wishlist label (a no-op — those
    labels never contained underscores) was correctly dropped.
  - **Score math genuinely unchanged.** The composite computation (weights, `sum`,
    `round1`, thresholds) in `overview.tsx` is byte-for-byte preserved; only the label
    branch was extracted. No `lib/services/*-analysis.service.ts` or `sentiment.service.ts`
    file is touched by `1c524c0a`. Presentational-only, as claimed.
  - **Tests cover owned + not-owned.** `lib/utils/research-scores.test.ts:49-77` asserts
    all four wishlist boundaries, all four portfolio boundaries (including the exact
    boundary values 8.5 / 7.0 / 5.0 and the 4.9 fall-through), and an explicit
    "same score, different label by context" case (`verdictLabel(6, "wishlist") === "WATCH"`
    vs `verdictLabel(6, "portfolio") === "REDUCE"`). Meaningful coverage.
- **MRD-S1 — RESOLVED.** `components/technical-analysis.tsx:64-65` narrows `currentPrice`
  to `number | null`, and all three SMA interpretation rows (20/50/200) now branch on
  `currentPrice == null → "Price unavailable"` before the above/below comparison, so an
  empty chart series no longer implies a bearish reading.
- **MRD-S2 — RESOLVED.** `components/research/detail-price-chart.tsx:106-146` renames the
  shared denominator `hoverValueRange → valueRange` (used by both the hover marker and the
  reference lines) and clamps `ref.value` to `[min, max]` before computing `yFrac`, so a
  future out-of-range support/resistance level (TD-DTL-SR) renders at the plot edge rather
  than clipping off the SVG. Hover math unchanged.
- **MRD-S3 — RESOLVED.** `components/analyst-ratings.tsx:100` derives the header count from
  `totalRatings` (the bucket sum, defined at line 85 before use) — the same denominator the
  distribution bars use — so the header and bars can no longer disagree.

### Standing checklist (iteration 2)
- Working tree clean (`git status --porcelain` empty). ✓
- STATUS.md 13 lines, links only, no narrative (the `## Blocked` entry is TD-01/ADR-7, a
  standing production-deploy gate, not this PR's state). ✓
- `TECH_DEBT.md`, `DECISIONS.md`, ADRs, index files conform to template structures;
  `reviews/INDEX.md` and `plans/INDEX.md` rows present (plan row correctly `in review`, not
  yet `implemented`). ✓
- No secrets; `.env` and `scratch/` gitignored; secret-scan passes. ✓
- No hardcoded colors introduced by `1c524c0a` (the only `hsl(var(` match in the diff is an
  AGENT.md prose line describing ADR-8, not code). ✓
- Verify block present and green. ✓

### Doc drift (iteration 2)
Docs updated in the same commit and accurate: `ARCHITECTURE.md` documents the new
`verdictLabel` export and the ownership-driven `context`; `AGENT.md` records the
ownership-lookup duplication as a fragile surface with a "extract `usePositionQuery` before
a third copy" guidance; `TECH_DEBT.md` TD-DTL-SR notes the MRD-S2 rendering cleanup while
keeping the underlying data gap open. No drift.

**Ready for owner to finalize.** No findings require owner input. The orchestrator sets
`Status: IMPLEMENTED` and advances the plan row.
