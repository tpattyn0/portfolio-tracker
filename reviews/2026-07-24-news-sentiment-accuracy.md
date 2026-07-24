# Review: News & sentiment — retrieval coverage and scoring accuracy
Date: 2026-07-24
Status:

Branch: `feature/news-sentiment-accuracy` @ `39a6910f` · PR https://github.com/tpattyn0/meridian/pull/36
Plan: `plans/2026-07-24-news-sentiment-accuracy.md` (all 14 tasks, 0-13)
Diff reviewed: `git diff main...HEAD` — 33 files, +3087 / -416

**Security-pass note.** The `security-review` skill diffs the *working tree against HEAD*. This
branch's work is fully committed, so that diff is empty and the skill has no meaningful input.
Per CLAUDE.md's Reviewer Step 1 carve-out, the skill was adapted: the security pass was run
manually against the branch range `main...HEAD`, with live probes for the two new attack surfaces
(untrusted third-party XML parsing, and the batched LLM call). Findings are folded in below.

## Summary
Findings: 0 BLOCKERs, 2 ISSUEs, 3 SUGGESTIONs, 1 QUESTION
Requires owner decision: NSA-Q1
Ready for Coding agent: NSA-I1, NSA-I2, NSA-S1, NSA-S2, NSA-S3

Verification run live this session: `npm run verify` — **pass** (typecheck ok · lint ok ·
**365/365 tests** · gitleaks `no leaks found`). Working tree clean at review time; branch pushed
and up to date with its upstream.

**Overall judgement: strong implementation; merge-ready once NSA-I1 is fixed.** The reported bug
is genuinely fixed and pinned by a test asserting the owner's exact case. Every constraint the
plan flagged as a trap was respected. The two ISSUEs are both narrow and concrete: one real
cross-call-site score desync that the plan explicitly set out to prevent (NSA-I1), and the test
that was supposed to catch it being tautological (NSA-I2).

### What was verified clean (audited, no finding raised)

- **Task 0's gitleaks trap — fully respected.** `git diff main...HEAD --stat` over
  `.gitleaks.toml`, `.gitleaks-local/`, `.env`, `.env.local` is **empty**: all four untouched, as
  the plan required. The line-anchored fingerprints (`.env:newsapi-key:13`,
  `.env:gcp-api-key:16`, `.env:gemini-api-key-assignment:16`) are intact, the `newsapi-key`
  gitleaks *rule* is retained (`.gitleaks.toml:19-22`) so the history detector still fires, and
  `continue-on-error: true` is still present on the `secret-history` job
  (`.github/workflows/verify.yml:134`). The local secret scan passes.
- **No overclaiming on TD-01 / ADR-7 / TD-28.** `TECH_DEBT.md:11` states plainly that the key
  "**remains live and publicly readable in git history**", that removing the consumer "does not
  unpublish or revoke it", and marks TD-01 amended-not-closed at severity Low. ADR-7 is marked
  `Status: superseded by ADR-33` with its text left intact for history — superseded, not edited
  in place, exactly as the plan required. ADR-33 is `accepted` and repeats the
  not-revocable/not-closed caveats. The CI comment block was updated to match. No document
  claims the key is safe.
- **XXE / entity expansion: not exploitable.** Probed live —
  `cheerio.load(xml, { xmlMode: true })` (htmlparser2) does **not** resolve custom DTD entities.
  An external-entity payload (`<!ENTITY xxe SYSTEM "file:///etc/passwd">`) yields the literal
  string `&xxe;`, and a billion-laughs payload yields the literal `&lol2;`. No file read, no
  expansion. Combined with a hard 4s `AbortController` timeout, non-OK status returning `[]`,
  and the parse wrapped in its own try/catch returning `[]`, hostile or malformed feed content
  cannot crash the route — the degraded state is a thin-sample card, which is precisely what the
  plan predicted.
- **Junk-title guard works.** The fixture retains the real `META_TITLE_QUOTE - Yahoo Finance`
  item and `news.service.rss.test.ts:46` asserts 9 of 10 items survive, with an explicit
  assertion that no surviving title contains `META_TITLE_QUOTE`.
- **Off-topic RSS items are correctly rejected despite self-tagging.** `fetchGoogleNewsRSS` sets
  `symbols: [symbol]` on every item, which grants the unconditional `+0.3` symbols bonus in
  `scoreRelevance`. I probed whether that alone could push an off-topic item past the filter: it
  scores exactly **0.3**, below `MIN_RELEVANCE = 0.4`. "Why Micron Stock Popped Today" and the
  Intel headline both score 0.3 *with* the self-tag and are dropped. The margin is one notch, but
  it holds. (See NSA-S2 — worth a regression test, not a defect.)
- **Batch results cannot be mismatched.** `sentiment.service.ts:188-195` pre-seeds the result map
  with every input id set to `null`, then only overwrites on `results.has(item.id)` — so an
  unknown id is discarded, an omitted id stays `null`, and ordering is irrelevant. Locked by a
  reordered-ids test (`sentiment.service.test.ts:121`).
- **No silent-neutral remains.** `{ ok: false }` propagates to `news.service.ts:430`, which skips
  all persistence. Asserted at `news.service.test.ts:118` (`updateMock` not called; every article
  stays `sentiment === null`).
- **Model chain is sensible and failure-handled.** `['gemini-2.5-flash', 'gemini-flash-latest',
  'gemini-3.5-flash']` — leads with the currently-pinned model, includes a Google-maintained
  alias, and correctly excludes the retired `gemini-1.5-flash`. The commit records that
  `gemini-2.5-flash-lite` was probed and 404s, so it was excluded rather than assumed. Fallthrough
  and total-failure paths are both tested.
- **The reported bug is fixed and pinned.** `research-scores.test.ts:83` asserts the owner's exact
  case: 2 articles averaging +0.92 no longer produces 9.6 and lands below 8.0 (measured: **6.8**,
  down from 9.6). A single +1.0 article no longer yields 10.0. Five uniformly strong-positive
  articles still reach 8+, so the fix is a recalibration, not a blanket suppression.
- **Deletions are all in scope.** Only `calculateRelevance` and `fetchNewsAPI` were removed from
  `news.service.ts`; only `analyzeSentiment`, `getSentimentLabel`, and `analyzeAndUpdateArticle`
  from `sentiment.service.ts`. `git grep` confirms **zero** remaining non-test callers of any of
  them. The rewritten `news.service.test.ts` replaces two tests that asserted the 3-call fan-out
  this change deliberately removes — genuinely obsoleted, not silently dropped, and the new suite
  covers strictly more (7 batch cases plus 4 dedup, 4 refresh-latch, 2 window, 6 RSS, 6 JSON).
- **Docs match code.** `ARCHITECTURE.md:8,19,45` reflect the source swap; `AGENT.md` gained the
  five fragile-surface entries; `future_ideas.md` records the rejected EODHD option; TD-41 was
  filed for the un-migrated `calculateDailySentiment` path. No drift found.

## Findings

### NSA-I1 — ISSUE
**File:** `components/news-feed.tsx:53` (interacting with `components/overview.tsx:153-162` and `lib/services/wishlist.service.ts:371-384`)

**Problem:** Task 11's stated goal is that the three call sites "all produce the identical score
for identical input," so the News tab, the Overview composite, and the wishlist "cannot silently
diverge." They still can, for two independent reasons, both reproduced numerically this session:

1. **A surviving hardcoded `0.5` relevance filter.** `news-feed.tsx:53` keeps
   `const news = allNews.filter((a) => (a.relevanceScore ?? 1) >= 0.5);`. Overview and wishlist
   apply **no** such filter. Since Task 5 lowered the shared ingest threshold to
   `MIN_RELEVANCE = 0.4`, articles scoring in `[0.4, 0.5)` are now persisted and served by the
   API, then counted by Overview/wishlist but **silently discarded by the News tab**. This is also
   the last surviving instance of exactly the `0.4`/`0.5` split Task 5 set out to eliminate by
   construction — the plan's own acceptance says "`grep` confirms `0.4`/`0.5` relevance literals
   appear nowhere outside the constant's definition," and this literal violates it.

2. **A different weighting population.** `news-feed.tsx:71-84` builds its weighted average over
   `analyzed` (sentiment non-null) only; `overview.tsx:145-153` and `wishlist.service.ts:365-375`
   iterate **all** articles, treating a `null` sentiment as `0` via `a.sentiment ?? 0`. Task 9
   makes `null` a *routinely reachable* state (any failed batch now leaves nulls where the old
   code wrote a fabricated `0`), so this pre-existing difference has been materially widened by
   this very change: unanalysed articles now drag the Overview/wishlist average toward neutral
   while the News tab ignores them — and the `analysedCount` passed to `dampenForSample` is
   computed identically in all three, so the damping does not compensate.

Reproduced (same input array, the three call sites' actual expressions):
- 5 articles, two at +0.92 / rel 0.9 and three at -0.8 / rel 0.4 → News tab **6.8**, Overview and
  wishlist **5.6**.
- 4 articles, two at +0.92 and two with `sentiment: null` → News tab **6.8**, Overview and
  wishlist **5.7**.

A 1.2-point disagreement between the News tab headline and the Overview composite's sentiment
dimension is the exact failure mode Task 11 was written to prevent, and it is user-visible on the
same page.

**Recommendation:** Make the population identical across all three. Concretely: (a) delete the
hardcoded `0.5` in `news-feed.tsx:53` and filter on the shared `MIN_RELEVANCE` imported from
`lib/utils/news-relevance.ts` (or drop the client-side filter entirely — the API already filters
at `MIN_RELEVANCE` server-side in `news.service.ts:360`, making it redundant); and (b) pick one
rule for unanalysed articles and apply it in all three — excluding `sentiment === null` from the
weighted average everywhere is the honest choice, and matches what `analysedCount` already
measures. Best done by extracting the whole weighted-average-plus-damping computation into one
shared exported helper in `lib/utils/research-scores.ts` that all three call, so the sync is
structural rather than by convention. Then fix NSA-I2 so the sync is actually tested.

---

### NSA-I2 — ISSUE
**File:** `lib/utils/research-scores.cross-site.test.ts:24-39`

**Problem:** The test named as Task 11's cross-site consistency guard cannot fail. It computes the
same expression three times in the test body — `round1(dampenForSample(calibratedSentimentToScore(
avgSentiment), analysedCount))` — assigns the results to `newsFeedScore`, `overviewScore`, and
`wishlistScore`, and asserts they are equal. It never imports, calls, or otherwise references
`news-feed.tsx`, `overview.tsx`, or `wishlist.service.ts`; it is asserting that a pure function is
deterministic. It passes identically whether the call sites agree or not — demonstrated by NSA-I1,
which is a live divergence that this test reports green on. The file's own docstring claims it
means "a future edit to any one call site's rounding/call order is caught," which is not true of
what it tests.

This matters more than a normal weak test: it is the *only* thing standing behind the plan's
explicit "cannot silently diverge" requirement, so its passing was reasonably read as that
requirement being met.

**Recommendation:** Make the test exercise the real call sites' logic on a shared article-array
input rather than three copies of one expression. The cheapest honest version, given TD-38 (no
render seam): extract each call site's sentiment computation into an exported pure function taking
`articles[]` (this falls out naturally from NSA-I1's shared-helper fix), then table-drive one test
over article arrays — including arrays with `relevanceScore` in `[0.4, 0.5)` and with
`sentiment: null` entries, the two cases that currently diverge — asserting the three functions
return the same number. If the helper is genuinely shared after NSA-I1, assert the three modules
import the same symbol.

---

### NSA-S1 — SUGGESTION
**File:** `lib/utils/research-scores.thin-sample-ui.test.ts:33-42, 44-49`

**Problem:** Task 12's coverage question, raised by the Coding agent itself (TD-38: no
jsdom/`@testing-library/react` seam in this repo). The mirror-test approach is a reasonable
response to a real constraint, and the file is honest about what it is. But two of its cases are
conditionally self-defeating: `if (state.score >= 7) { expect(state.trendBanded).toBe(false); }`
and `if (state.score >= 4 && state.score < 7) { ... }`. If the damping math changes so the guard
is never entered, the test passes while asserting nothing — the same failure mode as NSA-I2,
milder. (Measured now: `computeCardState(1.0, 4)` gives score 9.0, so the branch does execute
today.)

My judgement on adequacy: acceptable as a stopgap, not adequate as the permanent lock. The pure
decision values (score band, `isThinSample`, `trendKicker`, `trendBanded`) are genuinely the
component's whole decision surface here — the JSX below them is string interpolation — so the
logic risk is well covered. What is *not* covered is that the JSX still consumes those values;
a rename or a reordered ternary in `news-feed.tsx` would not be caught. That is the residual gap,
and it is correctly attributed to TD-38 rather than to this change.

**Recommendation:** Assert the score bands unconditionally (compute the expected value and assert
it directly, rather than guarding with `if`), so the cases cannot silently vacate. Separately,
consider raising TD-38's severity in `TECH_DEBT.md`: this is now the second consecutive plan
(after TD-33) to ship a UI change locked only by a mirror test, so the cost of the missing seam is
compounding rather than static.

---

### NSA-S2 — SUGGESTION
**File:** `lib/utils/news-relevance.ts:153-155`, `lib/services/news.service.ts:265`

**Problem:** Every RSS item is created with `symbols: [symbol]` — the requested symbol, self-
asserted by the fetcher rather than derived from the article. `scoreRelevance` then grants an
unconditional `+0.3` for it. So the symbols bonus, which exists to credit *independent* evidence
that an article is about this company, is a constant for the entire RSS source and carries no
information. The margin protecting the filter is one notch: an off-topic RSS item scores exactly
`0.3` against `MIN_RELEVANCE = 0.4`, so it is dropped — but any future tweak that lowers
`MIN_RELEVANCE` to 0.3, or adds any small additional signal, would admit *every* off-topic RSS
item unconditionally. Given ADR-34 accepts that ~4% of RSS items are about a different company,
and ADR-30 makes this filter the sole precision guard, the thin margin is worth pinning.

There is no test covering an off-topic article *carrying the RSS self-tag* — `news-relevance.test.ts:64-73`
tests the off-topic headlines without a `symbols` array, which is not the shape RSS actually
produces.

**Recommendation:** Add a regression test asserting an off-topic title with `symbols: [requestedSymbol]`
(the exact shape `fetchGoogleNewsRSS` emits) still scores below `MIN_RELEVANCE`. Optionally, do
not self-tag RSS items in a way that feeds the relevance bonus — either omit `symbols` at parse
time and set it after scoring, or have `scoreRelevance` ignore the bonus when the only entry is
the requested symbol itself.

---

### NSA-S3 — SUGGESTION
**File:** `lib/utils/news-relevance.ts:88-95`

**Problem:** `shareClassRoot`'s implementation does not match its documentation. The docstring and
its inline comment describe stripping "a single trailing letter," but the body only does
`upper.replace(/\.[A-Z]+$/, '')` — it strips an **exchange suffix**, never a class letter. The
actual share-class logic lives entirely in `tickerCreditsSymbol`'s `isTrailingClassVariant`. The
function is correct in effect (GOOG↔GOOGL works, verified by test), but the name and comment
describe behaviour that is not there, which is a trap for the next reader — and this file is now
listed in `AGENT.md` as a fragile surface.

**Recommendation:** Rename to `stripExchangeSuffix` and correct the comment to say the class-letter
handling is `isTrailingClassVariant`'s job. No behaviour change.

---

### NSA-Q1 — QUESTION
**File:** `lib/services/news.service.ts:35, 49` (`MAX_ARTICLES_PER_FETCH = 20`, `MAX_ANALYZE_PER_PASS = 10`)

**Problem:** Not a defect — a tuning call that interacts with the fix in a way the owner should
see before merge, and which the plan flagged as expecting "one tuning pass after the owner sees
real output."

The RSS feed returns ~100 items; the cap admits 20 per fetch, and at most 10 are analysed per
pass. With `MIN_CONFIDENT_SAMPLE = 5`, a first page load on a cold symbol analyses up to 10
articles in one batch, so the thin-sample state should clear on the first pass. But the interaction
worth confirming is at the *other* end: the refresh latch now refetches whenever the newest
in-window article is older than 15 minutes (`REFRESH_STALENESS_MS`), and `getAnalyzedNewsForSymbol`
analyses only `MAX_ANALYZE_PER_PASS` unanalysed articles per invocation. On a symbol with heavy
coverage, each refresh can add up to 20 new articles while only 10 get analysed — so the pool of
`sentiment: null` rows can grow across refreshes. Those nulls are excluded from the News tab
average but counted as `0` by Overview/wishlist (see NSA-I1), which would make the composite drift
toward neutral on the *best*-covered symbols. NSA-I1's fix removes the drift; the backlog itself
remains.

**Recommendation:** Owner decision on whether to (a) accept this as the expected tuning pass and
merge, adjusting after seeing live output, or (b) tune now — e.g. `MAX_ANALYZE_PER_PASS`
>= `MAX_ARTICLES_PER_FETCH` so a fetch's output is fully analysable in one pass. Note this
increases the size of a single Gemini batch. The plan's manual-verification checklist (the GOOGL
end-to-end case, the `.BR` ticker, the two-loads-6-minutes-apart latch check, the known-negative
symbol sanity check) has not been run in this session and is the natural place to settle it.

## Proposed DECISIONS.md entries

ADR-30 through ADR-34 were added by this branch and already carry `Status: accepted` with real
file:line evidence; ADR-7 is correctly marked superseded. No new ADRs are required from this
review.

One amendment to propose **only if the owner adopts the shared-helper approach in NSA-I1** (it
changes ADR-30's and Task 11's stated contract from convention to structure):

```
## ADR-35 — The News & sentiment headline score is computed by one shared helper, not three mirrored call sites
- **Decision:** The weighted-average-sentiment → calibrated map → sample-damping pipeline is
  extracted into a single exported helper in `lib/utils/research-scores.ts` taking the article
  array, and consumed unchanged by `components/news-feed.tsx`, `components/overview.tsx`, and
  `lib/services/wishlist.service.ts`. The three sites no longer each own a copy of the
  article-filtering, weighting, and counting logic — only the shared helper does. Articles with
  `sentiment === null` are excluded from the weighted average at all three sites (previously
  news-feed excluded them while overview/wishlist coerced them to 0), and relevance filtering uses
  the shared `MIN_RELEVANCE` everywhere (removing the last hardcoded `0.5` literal at
  news-feed.tsx:53).
- **Evidence:** `lib/utils/research-scores.ts`; the three call sites — not-implemented until
  NSA-I1 lands.
- **Tradeoffs:** Task 11 tried to keep the three in sync by convention plus a consistency test;
  the test was tautological (NSA-I2) and the sites diverged by up to 1.2 points in measured cases.
  Structural sharing costs a slightly less flexible per-site computation — accepted, because the
  divergence it prevents is user-visible on a single page (the News tab headline versus the
  Overview composite's sentiment dimension).
- **Status:** proposed
- **Confidence:** High
```
