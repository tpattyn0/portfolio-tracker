# PRODUCT.md

## What this is

**Meridian** — a personal stock portfolio tracker: users log real buy/sell transactions, see live-priced portfolio performance, and research any stock (owned or not) using automated technical, fundamental, valuation, and news-sentiment analysis. (Name meaning and rationale: `GTM.md` → Product name.)

## Who it's for

Individual retail investors who manage their own portfolio and want research tooling (technical/fundamental scoring, DCF-style intrinsic value, sentiment) in one place instead of assembling it from separate broker/screener tools. [REQUIRES INPUT: exact target segment, e.g. active vs. passive investors — belongs in `GTM.md`.]

## Core capabilities (implemented)

**Account & auth**
- Email/password registration and login (NextAuth credentials provider, JWT sessions).

**Portfolio**
- Add a position (buy) with quantity, price (per-share or total-amount), date, fees.
- Buy more of an existing position (recomputes average cost basis).
- Sell shares of a position (computes realized P/L).
- Delete a position (and its transactions).
- View portfolio overview: total value, today's change, total return, positions table, portfolio chart.
- Historical portfolio performance across configurable ranges (1D–10Y).
- Live price sync for all positions.
- Base display currency switch, with FX conversion.
- Closed/partially-closed position history — win rate, average/median return, average holding days, ticker/name filter, CSV export. Computed on the fly via FIFO matching of transactions; nothing is persisted for this feature.
- AI-generated daily portfolio insight (market summary, risks, opportunities, recommendations) via Gemini, cached once per user per day. Covers current holdings only — a fully-sold (closed) position is excluded from the prompt.

**Research** (available for any symbol, owned or not)
- Live quote and historical chart.
- Technical analysis: SMA/EMA, RSI, MACD, Bollinger Bands, Stochastic, volume trend, combined into a 7-level signal (STRONG_BUY…STRONG_SELL) with a 0–10 score and confidence tier.
- Fundamental analysis: ~25 metrics across valuation/profitability/growth/financial-health/dividends, combined into a weighted 0–10 score.
- Analyst ratings: buy/sell/hold counts and target price, reduced to a 1–10 score.
- Intrinsic value: DCF Lite, Graham Number, PEG-Adjusted, P/E Multiple, and P/B Multiple methods, confidence-weighted into a single fair-value estimate and rating (Significantly Undervalued → Significantly Overvalued).
- News with AI-generated sentiment scoring (Gemini) and daily sentiment history aggregates per symbol.

**Wishlist**
- Watch up to 50 stocks with a target price and notes.
- Composite score per item blending fundamental, technical, analyst, sentiment, and intrinsic-value scores.
- Flags when a target price is reached.

## What this does NOT do

- No live trade execution or brokerage connectivity — all positions are manually entered, self-reported transactions.
- No multi-user portfolios, sharing, or collaboration — one portfolio and one wishlist per user.
- No mobile app — web only.
- No real-time push updates — prices are fetched on demand / on sync.
- No persisted closed-position records — always recomputed from transaction history at request time.
- No industry/peer comparison data population — `IndustryComparison` is read by the intrinsic-value calculation but nothing currently writes to it, so relative-valuation methods fall back to hardcoded industry averages (P/E 15, P/B 1.5).

## Out of scope for now

See `future_ideas.md` for anything speculative. Do not add aspirational content here.
