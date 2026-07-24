# Plan: News & sentiment — retrieval coverage and scoring accuracy
Date: 2026-07-24

## Problem

The News & Sentiment tab reports a confident, wrong number. Owner evidence
(GOOGL research page): **9.6/10 "WARMING", 100% positive, from 2 articles**, on a
day GOOGL closed **-7.13%**. The two surviving articles were promotional
syndicated pieces; nothing that explained the selloff was retrieved.

This is not a source-coverage problem. Live probes run during planning (against
the configured `NEWS_API_KEY` / Yahoo, both present in `.env` and `.env.local`)
show the existing two sources currently offer **~31 relevant GOOGL articles**:

- **NewsAPI**, current query shape `"GOOGL" OR "Alphabet Inc."`: `totalResults = 575`.
  Of a 38-article page, **24 pass the ingest relevance filter**.
- **Yahoo** `search(symbol, {newsCount})`: **7 of 10 pass** — and the 7 include
  exactly the missing negative coverage ("Why Alphabet (GOOGL) Shares Are Getting
  Obliterated Today", "GOOGL Stock Sinks 8% A Day After Strong Q2 Earnings",
  "Google Stock Slides Toward Third Red Day As Capex Surge Drowns Out Cloud Growth").

So the sources already carry the selloff story. The pipeline discards it. Six
defects, each verified against the code and (where measurable) against live data:

**R1 — the refresh trigger is the primary cause of "2 articles."**
`news.service.ts:330` refreshes from upstream only when the DB holds `< 2`
articles. Once any 2 rows exist for a symbol, the pipeline **never fetches
again** — permanently. The screenshot's "2 articles" is this latch, exactly.

**R2 — the relevance filter drops market-moving headlines.**
`calculateRelevance` (L94-147) requires a *literal substring* match. Measured on
the live NewsAPI `publishedAt` feed, **14 of 38 articles are dropped at ingest**,
including:

| Score | Fate | Headline |
|---|---|---|
| 0.40 | DROP | Alphabet beats on cloud revenue, posts strong Gemini usage |
| 0.30 | DROP | US Stock Futures Slip on Alphabet, Oil Advances |
| 0.30 | DROP | Stock Indexes Mixed Ahead of Alphabet's Earnings |
| 0.30 | DROP | Big Tech Earnings Live: Alphabet Results Top Wall Street Expectations |

Three compounding causes:
- **The `> 0.4` boundary is strict** (L62), so a score of *exactly* `0.40` fails.
  An article whose title names the company but not the exact `companyName` string
  scores 0.40 and dies at ingest. This is the live dead-band, not the
  0.4–0.5 gap: scores are quantized to {0, 0.3, 0.4, 0.5, 0.6, 1.0}, so the
  briefed 0.4–0.5 band measured **empty**. The ingest boundary is the real killer.
  The `>0.4` / `>=0.5` mismatch (L62 vs L325) is still a genuine inconsistency and
  is fixed here, but it is second-order.
- **`companyName` is matched as an exact substring.** It arrives as Yahoo's
  `longName` — `"Alphabet Inc."` — so a title reading "Alphabet slides…" does not
  match, and contributes **0.0**.
- **`relatedTickers` misses dual-class tickers.** Yahoo returns `GOOG` for most
  GOOGL articles, so the `+0.3` symbols bonus (L126-131) silently never fires for
  the requested symbol.

**R3 — the unrelated-ticker penalty is dead code.** L134-142 runs
`/\b[A-Z]{2,5}\b/g` against `titleLower`, already lowercased at L96. Verified:
the match returns `null`, always. The penalty has never once applied — but the
thresholds were tuned as if it did.

**R4 — `deduplicateNews()` (L248-265) is defined and never called.** Measured: **5
near-duplicate titles inside the NewsAPI page alone**, before Yahoo overlap.
Duplicates consume slots in the cap and double-count in the sentiment average.

**R5 — three inconsistent time windows.** L318-328 filters `publishedAt >= now-7d`;
the two refetches (L340-347, L381-388) drop the date filter **entirely** (so they
can return articles of any age); the UI caption says "LAST 30 DAYS"
(`news-feed.tsx:106`). All three disagree. None is 30 days.

**R6 — the analysis cap silently truncates.** `slice(0, 3)` (L358) analyses at
most 3 unanalysed articles per request; `slice(0, 10)` (L79) caps the fetch.
Downstream, unanalysed articles are **excluded** from the aggregate
(`news-feed.tsx:56` filters `sentiment !== null`) but **counted** in the displayed
article total (L106/L113 use `news.length`) — so the caption can claim more
articles than the score is actually built from.

And the score itself is overstated independently of retrieval:

**S1 — the 0–10 mapping is linear and uncalibrated.** `sentimentToScore`
(`lib/utils/research-scores.ts:10`) is `(s+1)*5`. Two articles at +0.92 average
map to **9.6/10** — a figure that reads as near-maximum conviction. Reproduced
exactly: this is where the owner's 9.6 comes from (`news-feed.tsx:84`).

**S2 — a 2-article sample produces a full-confidence headline.** There is no
minimum-sample or confidence rule anywhere. One article at +1.0 would render
**10.0/10**.

**S3 — the error path is a silent neutral.** `sentiment.service.ts:75-85` returns
`{sentiment: 0, confidence: 0.5, impact:'low'}` on **any** failure, including a
JSON parse error. This is indistinguishable from a genuine neutral reading and is
persisted as if real. A total Gemini outage renders as "perfectly neutral news."

**S4 — the prompt has no calibration anchors** (L30-54), so nothing pins what
+0.9 means versus +0.4. Combined with S1's linear map, mild-positive coverage
inflates toward the top of the scale.

## Approach

Fix the pipeline in dependency order: **dead code and the refresh latch first,
then windows and dedup, then thresholds, then scoring.** A threshold cannot be
tuned while R1 freezes the corpus and R3 skews what the thresholds were set
against — so Tasks 1-4 must land before Task 5 tunes anything.

Scope is bounded by the owner's two settled decisions: **no new sources, no new
API keys, no new vendor cost**; and **sentiment analysis batches into a single
Gemini call** returning an array, rather than N concurrent calls.

Key design decisions:

**Relevance becomes token-aware, not substring-literal.** Derive a set of match
tokens from the symbol and company name — the raw symbol, the exchange-stripped
symbol, and the company name reduced to its distinctive core by stripping
corporate suffixes (`Inc.`, `Corp`, `Ltd`, `plc`, `NV`, `SA`, `Holdings`, `Class
A/B/C`). `"Alphabet Inc."` yields the token `alphabet`, which matches "Alphabet
slides…". Match on **word boundaries**, not bare `includes`, so `SA` cannot match
inside "Salesforce". This is the single change that recovers the market-context
articles in the R2 table.

**Ticker matching normalizes share classes.** Compare `relatedTickers` against the
symbol's root (strip a trailing class letter for known dual-class shapes) so
`GOOG` credits a `GOOGL` request. Conservative: applied only when the candidate
differs from the requested symbol by a trailing class character.

**One relevance threshold, one constant, one time window.** A single exported
`MIN_RELEVANCE` used by both the ingest filter and every DB read — eliminating the
`>0.4` / `>=0.5` split by construction — with a `>=` comparison so an exactly-at-
threshold article is kept. A single exported `NEWS_WINDOW_DAYS = 30` applied to
**all three** queries, matching the UI's existing claim.

**Sentiment batches into one Gemini call.** Replace the per-article
`analyzeAndUpdateArticle` fan-out with `analyzeSentimentBatch(articles)`: one
request containing N numbered articles, one JSON array response, results matched
back **by explicit index echoed in the response** (not array position alone — a
model that drops or reorders an entry must not silently shift every downstream
article's sentiment onto the wrong row). Any article whose index is absent from
the response stays `null` (unanalysed) rather than being written a fabricated
neutral. This is what lets the analysed count rise from 3 to the full page at
roughly one call per refresh instead of N.

**Failures stop masquerading as neutral.** `analyzeSentiment`'s catch returns an
explicit failure signal that callers must handle; a failed analysis leaves
`sentiment` as `null` (pending) in the DB rather than writing `0`. `null` is
already correctly excluded from the aggregate and already renders as "PENDING" in
the coverage list (`news-feed.tsx:31`), so this needs no new UI state — it just
stops a failure from voting `0` into the average.

**The headline score gains calibration and sample-awareness.** Two changes, both
in pure, testable helpers:
1. A **non-linear map** replacing `(s+1)*5`, compressing the extremes so that
   genuinely uniform, high-conviction coverage is required to reach 9+. Mild
   positive coverage lands in the 6-7 band where it belongs.
2. **Confidence damping toward neutral on thin samples.** Below a minimum sample
   (`MIN_CONFIDENT_SAMPLE = 5` analysed articles), the score is shrunk toward 5.0
   proportionally to how thin the sample is, so 2 articles cannot yield 9.6. The
   damping is continuous — no cliff at the boundary.

**The card tells the truth about its sample.** The caption and meta kicker are
driven by the *analysed* count, not the retrieved count, and a thin sample is
labelled as such. This is a **visible UI change** — see `## Assumptions`.

Deliberately **not** in scope: new sources; changing `calculateDailySentiment`'s
impact-weighting math (it is not on the path that produces the headline — traced:
the 9.6 comes from `news-feed.tsx:84`, and `SentimentHistory` is only read by
`/api/sentiment/[symbol]/history`, which no current component consumes); the
TD-DTL-TONE MoM delta.

## Tasks

1. [ ] **Delete the dead unrelated-ticker penalty** (`news.service.ts:134-142).
   Remove the block outright rather than "fixing" it against the original-case
   title — reintroducing a live penalty would change every score at once, in the
   same change that retunes thresholds, making both untestable. Note its removal
   in the plan's Verification notes. —
   Acceptance: a unit test asserts a title containing unrelated uppercase tickers
   (e.g. "GOOGL vs MSFT and AMZN") scores identically before and after; `grep -n
   "unrelatedTickers" lib/services/news.service.ts` returns nothing.

2. [ ] **Fix the refresh latch** (`news.service.ts:330`). Replace the `< 2` guard
   with a staleness-aware condition: refresh when the DB has fewer than a target
   number of in-window articles **or** when the newest in-window article is older
   than a short freshness TTL. The existing 5-minute `node-cache` in
   `fetchNewsForSymbol` (L22) already bounds upstream call volume, so this cannot
   turn into a per-request fetch storm. —
   Acceptance: a unit test with a mocked Prisma returning 2 **stale** articles
   asserts `fetchNewsForSymbol` **is** called; a second with a full set of fresh
   articles asserts it is **not**. Both assert the 5-min cache still short-circuits
   a second immediate call.

3. [ ] **Reconcile the three time windows.** Export `NEWS_WINDOW_DAYS = 30` and
   apply the same `publishedAt >= now - NEWS_WINDOW_DAYS` filter to all three
   queries (L318-328, L340-347, L381-388), so the two refetches stop returning
   unbounded-age articles. —
   Acceptance: a unit test asserts all three `findMany` calls receive an identical
   `publishedAt.gte`; the UI's existing "last 30 days" caption is now accurate.

4. [ ] **Wire up deduplication.** Call the existing `deduplicateNews()` in
   `fetchNewsForSymbol` on the merged Yahoo + NewsAPI array, **before** relevance
   scoring and before the cap, so duplicates cannot consume slots. Also fix its
   `seen` set, which currently mixes normalized-title keys and raw URLs in one set
   — harmless today but a collision waiting to happen; use two sets. —
   Acceptance: a unit test feeds an array containing a known duplicate pair
   (same title, differing URL and source) and asserts one survives, and that the
   post-dedup count is what the cap is applied to. Measured baseline: 5 dupes in a
   single live NewsAPI page.

5. [ ] **Rewrite relevance scoring** (`calculateRelevance`, L94-147) — only now
   that Tasks 1-4 have removed the confounds. Extract to a pure, exported,
   unit-testable helper (`lib/utils/news-relevance.ts`): token derivation
   (corporate-suffix stripping), word-boundary matching, and share-class-aware
   ticker normalization. Introduce a single exported `MIN_RELEVANCE` used with
   `>=` by both the ingest filter (L62) and **all three** DB reads (L324, L344,
   L385), removing the `>0.4`/`>=0.5` split. —
   Acceptance: table-driven unit tests over the exact live-measured cases in the
   R2 table — "US Stock Futures Slip on Alphabet", "Stock Indexes Mixed Ahead of
   Alphabet's Earnings", "Alphabet beats on cloud revenue" all score **at or above
   `MIN_RELEVANCE`** for symbol `GOOGL` / name `"Alphabet Inc."`; a genuinely
   unrelated article ("TSMC Stock: A $64 Billion Bet") scores **below** it; a
   `GOOG`-tagged article credits a `GOOGL` request. `grep` confirms `0.4`/`0.5`
   relevance literals appear nowhere outside the constant's definition.

6. [ ] **Raise the article cap** (`news.service.ts:79`). Replace the hardcoded
   `slice(0, 10)` with an exported `MAX_ARTICLES_PER_FETCH`, raised to a value
   that accommodates the ~31 relevant articles the sources actually return.
   Yahoo's own ceiling is a **hard 10 regardless of `newsCount`** (verified:
   `newsCount: 30` still returns exactly 10), so the increase is realized on the
   NewsAPI side — raise its `pageSize` (L204) to match and switch `sortBy` from
   `'relevancy'` to `'publishedAt'`. Rationale, measured: `relevancy` returns
   evergreen filler ("Is Alphabet Inc. Among the Ray Dalio Stock Portfolio…"),
   while `publishedAt` returns the market-moving coverage. Relevance is now
   enforced by our own scorer (Task 5), so delegating it to NewsAPI's opaque
   ranking buys nothing and costs recency. —
   Acceptance: a unit test asserts the NewsAPI request URL carries
   `sortBy=publishedAt` and the raised `pageSize`, and that the merged result is
   capped at `MAX_ARTICLES_PER_FETCH` after dedup, not before.

7. [ ] **Batch the Gemini call** (`sentiment.service.ts`). Add
   `analyzeSentimentBatch(articles)`: one `generateContent` request containing N
   numbered articles, parsed as a JSON array, results matched back **by the index
   echoed in each response element**. An article whose index is missing from the
   response is left unanalysed (`null`), never defaulted. Replace the
   `Promise.all` fan-out over `slice(0, 3)` (`news.service.ts:354-379`) with a
   single batch call over up to `MAX_ANALYZE_PER_PASS` articles. Keep the existing
   lazy `import('./sentiment.service')` exactly as-is — it is the documented guard
   against the module-scope `GEMINI_API_KEY` throw (AGENT.md fragile surface). —
   Acceptance: unit tests assert (a) one `generateContent` call for N articles,
   not N calls; (b) a response missing one index leaves that article `null` and
   still writes the others correctly; (c) a response with **reordered** indices
   maps each sentiment to the correct article; (d) a malformed/non-JSON response
   writes **nothing** rather than neutral zeros. Update
   `news.service.test.ts`, whose current test asserts exactly the 3-call fan-out
   this task removes.

8. [ ] **Stop silent-neutral masking** (`sentiment.service.ts:75-85`). The catch
   must surface failure rather than return a well-formed neutral: return an
   explicit failure result, and have `analyzeAndUpdateArticle` / the batch path
   leave `sentiment` as `null` on failure instead of persisting `0`. Log once per
   failed batch, not per article. —
   Acceptance: a unit test asserts a rejected `generateContent` results in **no**
   `prisma.newsArticle.update` writing `sentiment: 0`; the article remains `null`
   and is therefore excluded from the aggregate (already the behaviour at
   `news-feed.tsx:56`) and renders "PENDING". Update the existing
   `sentiment.service.test.ts` case at L72-87, which currently asserts the
   silent-neutral return being removed here.

9. [ ] **Add calibration anchors to the prompt** (`sentiment.service.ts:30-54`),
   carried into the batch prompt from Task 7. State explicitly what the scale
   means, with anchored examples: routine analyst-target and syndicated
   promotional coverage → mild (±0.2-0.4); genuine company-specific
   earnings/guidance/regulatory news → strong (±0.6-0.9); reserve ±0.9+ for
   major surprises. Instruct that a price-move article's sentiment must follow the
   **direction of the move**, and that `impact` reflects market materiality, not
   the article's tone. —
   Acceptance: a unit test asserts the generated prompt contains the anchor
   examples and the index-echo instruction. This task's real validation is the
   manual check below — the unit test only guards against silent prompt loss.

10. [ ] **Calibrate the 0-10 map and damp thin samples.** In
    `lib/utils/research-scores.ts`, add a non-linear `sentimentToScore` replacement
    and a `dampenForSample(score, analysedCount)` helper shrinking toward 5.0 below
    `MIN_CONFIDENT_SAMPLE = 5`. **`sentimentToScore` itself must keep its current
    exact behaviour and its passing tests** — it is also consumed by
    `components/overview.tsx:150` (the composite's sentiment dimension) and
    mirrored in `lib/services/wishlist.service.ts:352`; introduce the calibrated
    map as a **new** exported function and migrate all three call sites
    deliberately in this task, so the composite and the wishlist cannot silently
    diverge from the News tab. —
    Acceptance: unit tests assert **the owner's exact reported case** — 2 articles
    averaging +0.92 no longer produces 9.6 and lands below 8.0; a single +1.0
    article does not produce 10.0; ≥5 uniformly strong-positive articles still
    reach the 8+ band; the neutral midpoint stays exactly 5.0; and the three call
    sites (news-feed, overview, wishlist) all produce the identical score for
    identical input.

11. [ ] **Make the card honest about its sample** (`components/news-feed.tsx`).
    Drive the meta kicker and caption off the **analysed** count rather than
    `news.length` (L106, L113), and surface a thin-sample state when analysed
    count is below `MIN_CONFIDENT_SAMPLE`. Use existing `DESIGN.md` tokens and the
    existing `HeadlineScoreCard` slots only — no new chrome. The `ScoreFigure`
    `null/unavailable → --mut` band already exists for the zero-analysed case. —
    Acceptance: rendering with 2 analysed articles shows a damped score and a
    thin-sample caption; with 0 analysed shows the existing no-coverage state;
    the meta-kicker count matches the number actually feeding the score. **Visible
    UI change — Designer stage applies.**

12. [ ] **Update docs.** `TECH_DEBT.md`: resolve nothing that isn't resolved, and
    add a Backlog entry for the remaining `calculateDailySentiment` /
    `SentimentHistory` path (impact-only weighting, and the fact that nothing
    currently reads the history route) if it is still unaddressed. `ARCHITECTURE.md`:
    update the `news.service.ts` / `sentiment.service.ts` rows for the batch call
    and the shared constants. `AGENT.md`: add fragile-surface entries for the
    relevance-scoring helper and the batch index-matching contract. Add the ADRs
    below to `DECISIONS.md`. —
    Acceptance: `grep` confirms each touched invariant is documented; ADR entries
    cite real file:line evidence.

## Files to create or modify

- `lib/services/news.service.ts` — refresh latch, windows, dedup wiring, cap, thresholds, batch call
- `lib/utils/news-relevance.ts` *(new)* — pure token derivation + relevance scoring
- `lib/utils/news-relevance.test.ts` *(new)*
- `lib/services/sentiment.service.ts` — batch method, prompt anchors, failure signalling
- `lib/utils/research-scores.ts` — calibrated map + sample damping
- `lib/utils/research-scores.test.ts` — extend
- `components/news-feed.tsx` — analysed-count caption, thin-sample state
- `components/overview.tsx` — migrate to the calibrated map (L150)
- `lib/services/wishlist.service.ts` — migrate to the calibrated map (L352, L385)
- `lib/services/news.service.test.ts` — rewrite the fan-out test for the batch
- `lib/services/sentiment.service.test.ts` — update the silent-neutral test
- `ARCHITECTURE.md`, `AGENT.md`, `DECISIONS.md`, `TECH_DEBT.md`, `DESIGN.md` (if the Designer adds a thin-sample pattern)

## Verification

The `## Verify` block in AGENT.md runs automatically. Beyond it:

- **The owner's exact case, end to end.** Load `/research/GOOGL` → News &
  sentiment. Expect: article count in the high teens or more (not 2); the
  coverage list containing negative/mixed headlines, not only promotional ones;
  and a score that is **not** 9.6 on a -7% day. Both API keys are configured
  locally, so this is directly checkable.
- **Confirm the refresh latch is broken.** Load the tab twice ~6 minutes apart
  (past the 5-min `node-cache` TTL) and confirm new articles appear rather than
  the same frozen set.
- **Confirm a single Gemini call per pass**, not N — observable in the request
  count / latency, or via a temporary log removed before commit.
- **Sanity-check calibration against a known-negative symbol** so the fix is not
  merely "less positive on GOOGL": pick a stock down sharply on company-specific
  news and confirm the score lands below 5.
- **Confirm no regression in the composite.** The Overview tab's sentiment
  dimension must move consistently with the News tab's headline (Task 10 migrates
  both) — they must not disagree.
- **Note in the PR** that Task 1 removes a never-executing penalty, so no score
  changes attributable to it.

## Assumptions

- **A sentiment-prompt rewrite and score recalibration are in scope** (Tasks 9,
  10) even though the owner scoped only retrieval and batching. Justification: the
  evidence shows the score is wrong for reasons retrieval alone cannot fix — a
  single +1.0 article still renders 10.0/10 after every retrieval fix lands, and
  the silent-neutral error path (S3) means a Gemini outage is currently
  indistinguishable from genuinely neutral news. Fixing retrieval without these
  would widen the sample but leave the headline number overstated. **If the owner
  wants scoring left alone, Tasks 9-11 can be dropped without affecting 1-8.**
- **Task 11 changes visible UI** (caption/meta-kicker copy and a thin-sample
  state). It is deliberately constrained to existing `HeadlineScoreCard` slots and
  `DESIGN.md` tokens, but the Designer stage should confirm the thin-sample
  treatment before it is coded.
- **`MIN_CONFIDENT_SAMPLE = 5` and the exact damping curve are starting values,
  not derived constants.** They are chosen so the owner's 2-article case is
  visibly damped while a realistic 15-30 article corpus is unaffected. Expect one
  tuning pass after the owner sees real output.
- **The raised NewsAPI `pageSize` stays within the free tier's per-request limit
  (100) and does not increase request count** — one request per refresh either
  way, so no new cost. Yahoo's 10-item ceiling is a hard upstream limit; total
  coverage is therefore bounded by NewsAPI's page size plus 10.
- **`calculateDailySentiment` / `SentimentHistory` are left as-is.** Traced: the
  9.6 does not originate there (it is `news-feed.tsx:84`), and the only reader of
  that data, `/api/sentiment/[symbol]/history`, has no current component consumer.
  Changing it would be unverifiable through the UI in this pass.
- **Share-class normalization is applied conservatively** (trailing class letter
  only). A symbol pair that differs by more than that will not be merged.

## Open decisions

None — the owner's two scope decisions (fix the existing pipeline, no new
sources; batch into a single Gemini call) settle the material questions, and the
remaining uncertainty is captured in `## Assumptions` above.

## Proposed DECISIONS.md entries

```
## ADR-30 — Relevance scoring is token-based with word-boundary matching, on one shared threshold
- **Decision:** Replace `news.service.ts`'s literal-substring relevance scoring with a
  pure, exported helper (`lib/utils/news-relevance.ts`) that derives match tokens by
  stripping corporate suffixes from the company name, matches on word boundaries, and
  normalizes share-class ticker variants (GOOG↔GOOGL). A single exported `MIN_RELEVANCE`,
  compared with `>=`, governs both the ingest filter and every DB read.
- **Evidence:** `lib/utils/news-relevance.ts` (new); `lib/services/news.service.ts` ingest
  filter and all three `findMany` relevance filters — not-implemented until this plan lands.
- **Tradeoffs:** Token matching is more permissive than substring matching and will admit
  some market-context articles that only mention the company in passing; accepted, because
  the measured alternative discards the articles that explain a -7% day. The dead uppercase
  penalty is removed rather than repaired, so no compensating precision mechanism remains —
  precision now rests entirely on the token/threshold pair.
- **Status:** proposed
- **Confidence:** High

## ADR-31 — Sentiment analysis is one batched Gemini call with index-echo matching; failures persist as null, never neutral
- **Decision:** Replace the per-article Gemini fan-out (capped at 3) with a single
  `analyzeSentimentBatch` request returning a JSON array. Results are matched back by an
  index echoed inside each response element, not by array position. An article absent from
  the response, or any parse/request failure, leaves `sentiment` as `null` (pending) — the
  prior silent `sentiment: 0, confidence: 0.5` fallback is removed.
- **Evidence:** `lib/services/sentiment.service.ts`; `lib/services/news.service.ts` analysis
  block — not-implemented until this plan lands.
- **Tradeoffs:** One batch is a single point of failure for N articles where the fan-out
  degraded per-article; mitigated by leaving unanalysed articles `null` (already excluded
  from the aggregate and rendered "PENDING"), which is strictly more honest than the
  fabricated neutral it replaces. Index-echo matching costs prompt tokens and depends on
  model compliance — hence the explicit "missing index stays null" rule rather than
  positional fallback.
- **Status:** proposed
- **Confidence:** Medium

## ADR-32 — The 0-10 sentiment headline is non-linear and damped on thin samples
- **Decision:** Replace the linear `(s+1)*5` map with a calibrated non-linear mapping, and
  shrink the score toward 5.0 when fewer than `MIN_CONFIDENT_SAMPLE` (5) articles were
  actually analysed. All three consumers — `components/news-feed.tsx`,
  `components/overview.tsx` (composite sentiment dimension), and
  `lib/services/wishlist.service.ts` — migrate together so they cannot diverge.
- **Evidence:** `lib/utils/research-scores.ts`; call sites `news-feed.tsx:84`,
  `overview.tsx:150`, `wishlist.service.ts:352,385` — not-implemented until this plan lands.
- **Tradeoffs:** The headline is no longer a pure linear read of the underlying mean, so a
  displayed score cannot be inverted back to a sentiment value by eye; accepted, because the
  linear map produced 9.6/10 from two promotional articles on a -7% day. Damping deliberately
  understates genuinely strong but thinly-covered news — the false-confidence failure is
  judged worse than the muted-signal one. The threshold and curve are tuned by judgement, not
  derived, and are expected to need one revision against real output.
- **Status:** proposed
- **Confidence:** Medium
```
