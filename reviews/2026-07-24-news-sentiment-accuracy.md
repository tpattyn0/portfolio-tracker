# Review: News & sentiment — retrieval coverage and scoring accuracy
Date: 2026-07-24
Status: IMPLEMENTED — 2026-07-24

Branch: `feature/news-sentiment-accuracy` · PR https://github.com/tpattyn0/meridian/pull/36
Plan: `plans/2026-07-24-news-sentiment-accuracy.md` (all 14 tasks, 0-13)

**This file covers two review iterations.** Iteration 1 (below) reviewed `main...39a6910f`.
Iteration 2 (`## Iteration 2` at the bottom) reviewed the fix pass, `3a108f29..41c9efd9`.
Iteration 1's findings are retained verbatim as the record of what was raised; their
resolution status is recorded in Iteration 2.

---

# Iteration 1

Branch HEAD reviewed: `39a6910f`
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

---

# Iteration 2

Date: 2026-07-24
Branch HEAD reviewed: `41c9efd9`
Diff reviewed: `git diff 3a108f29..HEAD` — 12 files, +339 / -136 (the fix pass, commit `c7d501cc`,
plus the orchestrator's `STATUS.md` bump `41c9efd9`)

**Security-pass note (unchanged rationale).** The `security-review` skill diffs the *working tree
against HEAD*; this branch is fully committed, so that diff is empty and the skill has no
meaningful input. Per CLAUDE.md's Reviewer Step 1 carve-out the skill was skipped and the security
pass run manually against `3a108f29..HEAD` instead — see "Security pass" below.

## Summary
Findings: 0 BLOCKERs, 1 ISSUE, 0 SUGGESTIONs, 1 QUESTION (carried forward)
Requires owner decision: NSA-Q1 (carried forward from iteration 1, deliberately not acted on)
Ready for Coding agent: NSA2-I1

Verification run live this session: `npm run verify` — **pass** (typecheck ok · lint ok ·
**363/363 tests** · gitleaks `no leaks found`). Working tree clean at review time
(`git status --porcelain` empty); branch pushed and level with `origin/feature/news-sentiment-accuracy`.

**Overall judgement: the fix pass is correct and the two ISSUEs are genuinely closed.** NSA-I1's
shared-helper extraction is structurally sound, and NSA-I2's rewritten test was verified to
actually fail — I reproduced three independent mutations in a throwaway git worktree and each one
broke the suite (detail below). The one new finding is a documentation miss, not a code defect:
`ARCHITECTURE.md`'s key-files row still describes the pre-fix two-function pipeline and never
mentions `computeSentimentScore`, while `AGENT.md`, `DECISIONS.md` (ADR-35), and `TECH_DEBT.md`
were all correctly updated.

## Iteration-1 findings — resolution status

| ID | Status | Verified how |
|----|--------|--------------|
| NSA-I1 | **Resolved** | `computeSentimentScore(articles)` added at `lib/utils/research-scores.ts:135`; all three sites call it (`news-feed.tsx:69`, `overview.tsx:148`, `wishlist.service.ts:371`). `rg` over `*.ts`/`*.tsx` finds **zero** remaining `sentiment ?? 0` coercions outside the helper (where it is a no-op after the null filter) and zero remaining relevance-threshold literals outside `MIN_RELEVANCE`'s definition — the plan's Task 5 acceptance criterion now actually holds. |
| NSA-I2 | **Resolved** | Mutation-tested, three ways — see "NSA-I2: independently verified the test can fail" below. |
| NSA-S1 | **Resolved** | Both conditionally-guarded cases in `research-scores.thin-sample-ui.test.ts:33-53` now assert the band unconditionally (`expect(state.score).toBeGreaterThanOrEqual(7)` / the explicit `[4, 7)` pair) *before* asserting the guarded behavior, so neither case can silently vacate. |
| NSA-S2 | **Resolved** | `news-relevance.test.ts:75-91` adds the off-topic-with-RSS-self-tag case, passing `symbols: [symbol]` — the exact shape `fetchGoogleNewsRSS` emits — for both probe headlines, asserting `< MIN_RELEVANCE`. This is the shape iteration 1 noted was untested. |
| NSA-S3 | **Resolved** | `shareClassRoot` → `stripExchangeSuffix` (`news-relevance.ts:88-93`), both call sites in `tickerCreditsSymbol` updated, docstring corrected to state that share-class-letter handling is `isTrailingClassVariant`'s job. Body unchanged — no behavior change, as intended. |
| NSA-Q1 | **Still open** | Deliberately not acted on; still requires the owner's decision. Restated below. |

## What was verified clean in iteration 2 (audited, no finding raised)

- **The `relevanceScore >= 0.5` deletion is sound — I traced every path, as asked.** The fix pass
  deleted `news-feed.tsx`'s client-side re-filter outright rather than repointing it at
  `MIN_RELEVANCE`, on the reasoning that the server already filters everything the component can
  see. That reasoning holds against the code:
  - `NewsFeed` has exactly two mount points (`rg "NewsFeed"`): `research/[symbol]/page.tsx:283`,
    which passes **no** `articles` prop and so uses the component's own `useQuery` against
    `/api/news/[symbol]`; and `portfolio/[ticker]/page.tsx:354`, which passes
    `articles={newsArticles}`.
  - That `newsArticles` (`portfolio/[ticker]/page.tsx:75-97`) is itself a `useQuery` against
    `/api/news/${ticker}` — the same route. So `propArticles` is not an independent supply path;
    it is the same server data hoisted a level for the page's own sentiment display.
  - `app/api/news/[symbol]/route.ts` has a single code path and returns
    `newsService.getAnalyzedNewsForSymbol(...)` unmodified — no alternate branch, no passthrough
    of an unfiltered set.
  - `getAnalyzedNewsForSymbol` (`news.service.ts:350-396`) reads through one `whereClause`
    containing `relevanceScore: { gte: MIN_RELEVANCE }`, used for **both** its initial
    `findMany` (line 363) and the post-refresh re-`findMany` (line 391); the refresh path
    additionally re-filters fresh articles at line 385 before persisting. Every return is
    `articles` derived from that clause, or `[]`.
  So no path can deliver an article below `MIN_RELEVANCE` to this component, and the deleted
  filter could only ever have disagreed with the server. Deletion was the right call, not a
  shortcut. (Articles now surfacing in the `[0.4, 0.5)` band are the *intended* effect of Task 5,
  not a regression.)
- **The null-sentiment rule is genuinely applied in one place, with no caller re-introducing a
  coercion.** The filter lives only at `research-scores.ts:136`. `rg` for `sentiment ?? 0` returns
  one hit — line 149, inside the helper, after the filter, where it is unreachable-as-a-coercion
  and serves only to satisfy the optional type. Neither `overview.tsx` nor `wishlist.service.ts`
  retains any local `?? 0`, local `analysedCount` computation, or local filter.
- **The retained `articles.length === 0 → 5` guards are consistent, not divergent.** Both
  `overview.tsx:141` and `wishlist.service.ts:363` keep an early return of `5` for an empty array.
  The helper independently returns `score: 5` when `analyzed.length === 0`, so these are redundant
  rather than a second behavior — empty input and all-null input both yield 5 at all three sites.
- **`news-feed.tsx`'s percentage denominators are unchanged in effect.** The old code divided by
  `analyzed.length`; the new code divides by `positiveCount + neutralCount + negativeCount`. Each
  analysed article increments exactly one bucket in the helper's loop, so the two are identical by
  construction. No display regression.
- **The `useMemo` wrapper on `news` is correct and necessary.** `const news = useMemo(() =>
  propArticles || fetchedArticles || [], [propArticles, fetchedArticles])` (`news-feed.tsx:61`)
  gives the `[]` fallback a stable identity, which the downstream `useMemo(..., [news])` depends
  on; without it the score memo would recompute every render on the no-articles path. `useMemo` is
  imported at line 3. The comment explains the reasoning accurately.
- **Test count 365 → 363 is fully accounted for by the tautology collapse — no tests were
  dropped.** The old `research-scores.cross-site.test.ts` was a single `it.each` over **6** cases
  (`git show 3a108f29:...`); the rewrite has **3** `it` blocks. NSA-S2 added **1** case to
  `news-relevance.test.ts`. 365 − 6 + 3 + 1 = **363**, matching the live run exactly.
  `git diff --diff-filter=D` confirms **no** test file was deleted, and the only three test files
  touched are the ones the fix pass reports.
- **Task 0's security constraints are undisturbed by the fix pass.** `git diff 3a108f29..HEAD
  --stat` over `.gitleaks.toml`, `.gitleaks-local/`, `.env`, `.env.local`, and
  `.github/workflows/verify.yml` is **empty** — all five untouched in iteration 2. Re-confirmed
  live at HEAD: the `newsapi-key` rule is still present (`.gitleaks.toml:20-23`),
  `continue-on-error: true` is still on the `secret-history` job
  (`.github/workflows/verify.yml:134`), `.env`/`.env*.local`/`scratch/` are still gitignored
  (`.gitignore:21-25,59,62`), and `git ls-files` shows only `.env.example` tracked. The local
  secret scan passes (`no leaks found`).
- **`ADR-35` matches what shipped.** It is `Status: accepted` (correctly upgraded from the
  `proposed` iteration 1 drafted) with real evidence paths, all of which resolve to code that
  exists. Its description of the null-exclusion rule and the removed `0.5` literal matches the
  implementation exactly — no overclaiming.
- **`AGENT.md` fragile-surface entry 5 was rewritten accurately**, including the explicit
  "do not regress the rewritten test back to that shape" instruction — the compounding-the-learning
  step done properly.

## NSA-I2: independently verified the test can fail

Iteration 1's substance was that a tautological test is worse than none, so I did not take the
fix pass's "I reverted it and saw 2/3 fail" report on trust. I checked out branch HEAD into a
throwaway `git worktree` under the scratch directory (no tracked file in this repo was modified at
any point) and ran three separate mutations against `research-scores.cross-site.test.ts`:

1. **Revert the NSA-I1 null-exclusion rule** — changed the helper's
   `articles.filter((a) => a.sentiment !== null && ...)` to `articles`. Result: **1 failed, 2
   passed**, failing at line 146 with `expected 4 to be 2` on `analysedCount`. The test catches
   the exact regression it exists for.
2. **Break the shared-symbol linkage from a component** — aliased news-feed's import to
   `computeSentimentScore as localComputeSentimentScore` and updated the call, simulating a
   component reverting to its own copy. Result: **1 failed**, at line 48's
   `expect(newsFeedSource).toMatch(/computeSentimentScore\(/)`. The grep-based structural
   assertion is doing real work, not just matching the import line.
3. **Diverge the wishlist delegate** — changed `wishlist.service.ts`'s one-line delegate to
   round the shared score to the nearest 0.5. Result: **2 failed** (both the direct-parity test
   at line 89 and the divergence-shapes test at line 153). The private-method binding really does
   exercise the live call site.

All three mutations were reverted and the worktree removed; `git status --porcelain` is empty.
I also ran the file with `GEMINI_API_KEY` and `DATABASE_URL` unset — it passes, so the
module-scope `wishlistService` import has not introduced a hidden environment dependency into the
suite (the lazy `sentiment.service` import in `news.service.ts` holds).

The one honest limitation, which the test file itself states: assertions 1 and 2 for
`news-feed.tsx`/`overview.tsx` are **source-text greps**, not executions, because TD-38 leaves the
repo with no component-render seam. A component could import and call the symbol while doing
something wrong with the result and the test would not notice. That is a real residual gap, but it
is correctly attributed to TD-38 and disclosed in the file's docstring — and it is strictly
stronger than iteration 1's version, which asserted nothing at all. Not raising it as a new
finding.

## Security pass (manual, `3a108f29..HEAD`)

Scanned every added line in the range for the standing categories — unauthenticated endpoints,
credentials at rest, overly broad permissions, injection surfaces, destructive ops without gates:

- **No route, middleware, or auth-guard file is in the diff.** No endpoint was added, and no
  existing endpoint's guard was touched.
- **No new `process.env` read, no new `fetch`, no new `prisma.*` call, no `exec`/`eval`/
  `child_process`/`dangerouslySetInnerHTML`** anywhere in the added lines.
- **The only new I/O in the entire range is `fs.readFileSync` at
  `research-scores.cross-site.test.ts:41,44`**, reading two fixed in-repo source paths resolved
  from `import.meta.url`. No user input reaches it, no path is interpolated, and it is test-only:
  `vitest.config.ts` scopes tests to `**/*.test.ts`, and nothing in `app/` or `components/`
  imports a test file, so it is not reachable from the Next.js bundle.
- **No destructive operation.** The diff adds one pure function and removes duplicated pure logic;
  the only persistence-adjacent file, `wishlist.service.ts`, had a private read-only computation
  replaced by a delegate.
- **No secrets.** gitleaks passes at HEAD; nothing in the diff resembles a credential.

No security findings in iteration 2.

## Findings

### NSA2-I1 — ISSUE
**File:** `ARCHITECTURE.md:56`

**Problem:** `ARCHITECTURE.md`'s key-files row for `lib/utils/research-scores.ts` still describes
the pre-fix design and was not updated by the fix pass. It reads:

> As of `plans/2026-07-24-news-sentiment-accuracy.md` (Task 11) also exports
> `calibratedSentimentToScore` (…) and `dampenForSample`/`MIN_CONFIDENT_SAMPLE` (…) — the
> calibrated News & sentiment scoring pipeline shared by `news-feed.tsx`, `overview.tsx`, and
> `wishlist.service.ts`.

That sentence is now the *iteration-1* architecture. It never mentions `computeSentimentScore`,
which is the module's new primary export and the actual thing the three call sites consume; it
describes the three sites as sharing two low-level primitives, which is precisely the
by-convention arrangement ADR-35 replaced because it failed. A reader consulting
`ARCHITECTURE.md` to find the sentiment-scoring entry point is pointed at the two functions they
should now be calling *through* the helper, not directly — the exact mistake ADR-35 and
`AGENT.md`'s fragile-surface entry 5 both explicitly warn against ("do not reimplement this inline
at a fourth call site").

`grep -rn "computeSentimentScore" *.md` confirms the miss is isolated: `AGENT.md:60`,
`DECISIONS.md:344,355`, and `TECH_DEBT.md:64-65` all name it. `ARCHITECTURE.md` is the only
required doc that does not, and per CLAUDE.md's hard limits it must reflect implemented reality.
Severity is ISSUE rather than SUGGESTION because this is a documented-decision-versus-doc
contradiction on a surface `AGENT.md` designates as fragile, not a stylistic gap.

**Recommendation:** Update the `lib/utils/research-scores.ts` row in `ARCHITECTURE.md:56` to lead
with `computeSentimentScore(articles)` as the shared News & sentiment entry point (citing ADR-35),
state that `news-feed.tsx`, `overview.tsx`, and `wishlist.service.ts` call it directly rather than
composing the primitives themselves, note the `sentiment === null` exclusion rule, and demote
`calibratedSentimentToScore`/`dampenForSample`/`MIN_CONFIDENT_SAMPLE` to internals of that helper
that remain exported for tests. Doc-only; no code change and no re-verification needed beyond
`npm run verify`.

---

### NSA-Q1 — QUESTION (carried forward from iteration 1, still open)
**File:** `lib/services/news.service.ts:35, 49` (`MAX_ARTICLES_PER_FETCH = 20`,
`MAX_ANALYZE_PER_PASS = 10`)

**Status:** unchanged and deliberately not acted on by the fix pass — correct, since it is a
QUESTION requiring the owner's decision, not an actionable finding. Neither constant was modified
in `3a108f29..HEAD`.

**One update from iteration 2 worth noting before the owner decides.** Iteration 1 framed the
consequence of the analysis backlog partly as "nulls counted as `0` by Overview/wishlist would
drag the composite toward neutral on the best-covered symbols." NSA-I1's fix removes that
drift entirely — `sentiment: null` is now excluded from the weighted average everywhere, so a
growing pending backlog no longer distorts any score. What remains is the narrower, benign
consequence: on a heavily-covered symbol each refresh can add up to `MAX_ARTICLES_PER_FETCH` (20)
articles while only `MAX_ANALYZE_PER_PASS` (10) are analysed per pass, so a pool of PENDING rows
can accumulate and be visible in the article list without ever affecting the headline score. The
decision is therefore now purely about analysis throughput and Gemini batch size, not about score
correctness — a smaller call than it was at iteration 1.

**Recommendation (unchanged):** owner decides between (a) accepting this as the expected tuning
pass and merging, adjusting after seeing live output, or (b) tuning now — e.g.
`MAX_ANALYZE_PER_PASS >= MAX_ARTICLES_PER_FETCH` so a fetch's output is fully analysable in one
pass, at the cost of a larger single Gemini batch. The plan's manual-verification checklist (the
GOOGL end-to-end case, the `.BR` ticker, the two-loads-6-minutes-apart latch check, the
known-negative symbol sanity check) has still not been run in either review session and remains
the natural place to settle it.

## Proposed DECISIONS.md entries (iteration 2)

None. ADR-35 was added by the fix pass, is `Status: accepted`, and its evidence paths all resolve
to code that exists at HEAD — it accurately records the decision iteration 1 proposed. No new
ADRs are required from this iteration; NSA2-I1 is a documentation correction, not a decision.
