/**
 * Token-based, word-boundary relevance scoring for news articles against a
 * stock symbol + company name — extracted from `news.service.ts`'s
 * `calculateRelevance` (plans/2026-07-24-news-sentiment-accuracy.md, Task 5,
 * ADR-30). Pure, exported, unit-testable: no DOM, no Prisma, no network.
 *
 * Replaces literal-substring matching (`companyName` matched as an exact
 * substring, e.g. "Alphabet Inc." never matching "Alphabet slides…") with
 * token derivation (corporate-suffix stripping) + word-boundary regex
 * matching, and adds share-class-aware ticker normalization (GOOG credits a
 * GOOGL request).
 *
 * `MIN_RELEVANCE` is the single threshold used by both the ingest filter and
 * every DB read in news.service.ts — eliminating the old `>0.4` / `>=0.5`
 * split. Comparisons must use `>=` so an exactly-at-threshold article is kept.
 */

/**
 * Corporate-entity suffixes to strip when deriving a company's distinctive
 * "core" token — ported verbatim from Compass (`src/lib/news/rss.ts:93`),
 * which is materially more complete than a hand-rolled version: it covers
 * `S.A.`, `société anonyme`, `N.V.`, `Oyj`, `ASA`, `AB`, `SE`, `plc`, `AG`,
 * `SpA` — relevant here because Meridian has Belgian/European tickers
 * (`BTLS.BR` appears in the current code).
 */
export const CORP_SUFFIX =
  /\b(s\.?a\.?|société anonyme|societe anonyme|n\.?v\.?|inc\.?|corp\.?|corporation|holdings?|group|company|co\.?|plc|ag|ltd\.?|limited|se|spa|ab|oyj|asa)\b/gi;

/** Single relevance threshold shared by the ingest filter and all DB reads (ADR-30). */
export const MIN_RELEVANCE = 0.4;

/**
 * Derives the match tokens for a symbol + optional company name: the raw
 * symbol, the exchange-stripped symbol, and the company name reduced to its
 * distinctive core by stripping corporate suffixes. Tokens are lowercased
 * and de-duplicated; tokens shorter than 2 characters are dropped (too
 * noisy for a word-boundary match).
 */
export function deriveMatchTokens(symbol: string, companyName?: string): string[] {
  const tokens = new Set<string>();

  const rawSymbol = symbol.trim().toLowerCase();
  if (rawSymbol.length >= 2) tokens.add(rawSymbol);

  const cleanSymbol = symbol.split('.')[0].trim().toLowerCase();
  if (cleanSymbol.length >= 2) tokens.add(cleanSymbol);

  if (companyName) {
    const core = companyName
      .replace(CORP_SUFFIX, '')
      .replace(/[,\s]+$/, '')
      .trim()
      .toLowerCase();
    if (core.length >= 2) tokens.add(core);

    // Also add the individual words of the core name (>2 chars each) so a
    // multi-word company name ("Alphabet Inc.") still matches via its most
    // distinctive single word ("alphabet") even if the exact-phrase core
    // itself doesn't appear verbatim in a headline.
    core
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .forEach((w) => tokens.add(w));
  }

  return Array.from(tokens);
}

/** Escapes a string for safe interpolation into a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary test: does `token` appear as a whole word in `text`? */
function matchesWordBoundary(text: string, token: string): boolean {
  if (!token) return false;
  const escaped = escapeRegExp(token);
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(text);
}

/**
 * Known dual-class share shapes: a trailing class letter (e.g. `GOOGL` vs
 * `GOOG`) is stripped for comparison, conservatively — only when the
 * candidate differs from the requested symbol by exactly a trailing class
 * character on an otherwise-identical root.
 */
function shareClassRoot(sym: string): string {
  const upper = sym.trim().toUpperCase();
  // Strip a single trailing letter if the remainder is at least 2 chars —
  // conservative: GOOGL -> GOOG's root is "GOOG" itself (no strip needed,
  // matched directly); this handles the reverse (GOOGL -> GOOG) by comparing
  // roots symmetrically in tickerCreditsSymbol below.
  return upper.replace(/\.[A-Z]+$/, '');
}

/**
 * True if `candidateTicker` (from an article's related-tickers list) should
 * credit a relevance match for `requestedSymbol`. Handles exact match and
 * conservative share-class normalization (GOOG <-> GOOGL): the two are
 * considered equivalent only when one is exactly the other with a single
 * trailing class letter added/removed.
 */
/** Trailing letters recognized as real dual-class share suffixes (e.g. GOOGL, BRK.B's "B"). */
const KNOWN_CLASS_LETTERS = new Set(["A", "B", "C", "K", "L"]);

export function tickerCreditsSymbol(candidateTicker: string, requestedSymbol: string): boolean {
  const a = shareClassRoot(candidateTicker);
  const b = shareClassRoot(requestedSymbol);
  if (a === b) return true;

  const isTrailingClassVariant = (longer: string, shorter: string) =>
    longer.length === shorter.length + 1 &&
    longer.startsWith(shorter) &&
    KNOWN_CLASS_LETTERS.has(longer[longer.length - 1]);

  if (a.length > b.length) return isTrailingClassVariant(a, b);
  if (b.length > a.length) return isTrailingClassVariant(b, a);
  return false;
}

export interface RelevanceInput {
  title: string;
  summary?: string | null;
  content?: string | null;
  symbols?: string[];
}

/**
 * Scores one article's relevance to `symbol`/`companyName` on a 0..1 scale,
 * token-based and word-boundary matched (not literal substring). Mirrors the
 * old weighting shape (title match to be worth more than summary, symbol
 * array match a solid bonus) but on tokens instead of raw search terms.
 */
export function scoreRelevance(
  article: RelevanceInput,
  symbol: string,
  companyName?: string
): number {
  const tokens = deriveMatchTokens(symbol, companyName);
  const titleText = article.title || '';
  const summaryText = article.summary || '';
  const contentText = article.content || '';

  let score = 0;

  for (const token of tokens) {
    if (matchesWordBoundary(titleText, token)) score += 0.5;
    if (matchesWordBoundary(summaryText, token)) score += 0.2;
    if (matchesWordBoundary(contentText, token)) score += 0.1;
  }

  if (article.symbols?.some((s) => tickerCreditsSymbol(s, symbol))) {
    score += 0.3;
  }

  return Math.max(0, Math.min(1, score));
}
