import { describe, expect, it } from "vitest";
import {
  MIN_RELEVANCE,
  deriveMatchTokens,
  scoreRelevance,
  tickerCreditsSymbol,
} from "./news-relevance";

describe("deriveMatchTokens", () => {
  it("derives the symbol, exchange-stripped symbol, and corporate-suffix-stripped company core", () => {
    const tokens = deriveMatchTokens("GOOGL", "Alphabet Inc.");
    expect(tokens).toContain("googl");
    expect(tokens).toContain("alphabet");
  });

  it("strips the exchange suffix for a European ticker", () => {
    const tokens = deriveMatchTokens("BTLS.BR", "Barco NV");
    expect(tokens).toContain("btls.br");
    expect(tokens).toContain("btls");
    expect(tokens).toContain("barco");
  });

  it("drops tokens shorter than 2 characters", () => {
    const tokens = deriveMatchTokens("A", undefined);
    expect(tokens).not.toContain("a");
  });
});

describe("tickerCreditsSymbol — share-class normalization", () => {
  it("credits GOOG for a GOOGL request (trailing class letter)", () => {
    expect(tickerCreditsSymbol("GOOG", "GOOGL")).toBe(true);
    expect(tickerCreditsSymbol("GOOGL", "GOOG")).toBe(true);
  });

  it("matches an exact ticker", () => {
    expect(tickerCreditsSymbol("AAPL", "AAPL")).toBe(true);
  });

  it("does not credit unrelated tickers", () => {
    expect(tickerCreditsSymbol("MSFT", "GOOGL")).toBe(false);
  });

  it("is conservative — a symbol differing by more than a trailing class letter is not merged", () => {
    expect(tickerCreditsSymbol("GOOGLE", "GOOGL")).toBe(false);
  });
});

describe("scoreRelevance — live-measured GOOGL/Alphabet cases (plan Task 5 acceptance)", () => {
  const symbol = "GOOGL";
  const companyName = "Alphabet Inc.";

  it("scores real on-topic RSS headlines at or above MIN_RELEVANCE", () => {
    const onTopic = [
      "Tesla, Alphabet lose hundreds of billions in value in post-earnings stock plunge",
      "Alphabet earnings are out and the stock is falling",
      "When AI CapEx Eats Cash: Is Alphabet's Huge Bet Building a Moat or Sinking Margins?",
    ];
    for (const title of onTopic) {
      const score = scoreRelevance({ title }, symbol, companyName);
      expect(score).toBeGreaterThanOrEqual(MIN_RELEVANCE);
    }
  });

  it("scores real off-topic RSS headlines below MIN_RELEVANCE", () => {
    const offTopic = [
      "Why Micron Stock Popped Today",
      "Intel Stock Jumps as Earnings Blow Past Expectations Amid Booming AI Demand",
    ];
    for (const title of offTopic) {
      const score = scoreRelevance({ title }, symbol, companyName);
      expect(score).toBeLessThan(MIN_RELEVANCE);
    }
  });

  it("a GOOG-tagged article credits a GOOGL request via the symbols array (adds the symbols bonus)", () => {
    const withoutTag = scoreRelevance({ title: "Market wrap: tech megacaps mixed" }, symbol, companyName);
    const withGoogTag = scoreRelevance(
      { title: "Market wrap: tech megacaps mixed", symbols: ["GOOG"] },
      symbol,
      companyName
    );
    expect(withGoogTag).toBeGreaterThan(withoutTag);
  });

  it("a GOOG-tagged, Alphabet-titled article clears MIN_RELEVANCE for a GOOGL request", () => {
    const score = scoreRelevance(
      { title: "Alphabet earnings are out and the stock is falling", symbols: ["GOOG"] },
      symbol,
      companyName
    );
    expect(score).toBeGreaterThanOrEqual(MIN_RELEVANCE);
  });

  it("does not require a literal company-name substring match — word-boundary token match is sufficient", () => {
    // "Alphabet slides…" does not contain "Alphabet Inc." verbatim, but does
    // contain the distinctive core token "alphabet".
    const score = scoreRelevance({ title: "Alphabet slides on spending concerns" }, symbol, companyName);
    expect(score).toBeGreaterThanOrEqual(MIN_RELEVANCE);
  });

  it("SA cannot match inside Salesforce (word-boundary, not bare includes)", () => {
    const score = scoreRelevance(
      { title: "Salesforce announces new AI product" },
      "SA",
      "Some SA Company"
    );
    // "sa" as a token must not match inside "Salesforce" — no word boundary there.
    expect(score).toBeLessThan(MIN_RELEVANCE);
  });
});
