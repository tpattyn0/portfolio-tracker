# GTM.md

> Owner-facing GTM strategy, written 2026-07-17 (GTM expert session). All product claims are
> traceable to `PRODUCT.md`. Business assumptions that could not be substantiated are flagged
> inline and collected in `## Assumptions [REQUIRES CONFIRMATION]` at the bottom — approving
> this file approves those assumptions.

## Product name

**Meridian.**

A meridian is an imaginary line of longitude running pole to pole — the reference line navigators
and mapmakers use to fix a position. The most famous is the Prime Meridian at Greenwich, the zero
point from which all time zones and positions are measured. Figuratively, a meridian is also a high
point or peak ("the meridian of his career"), from the Latin *meridianus* — midday, when the sun is
highest.

The name works on both levels for this product: a **fixed reference line for navigating your
finances**, and the **pursuit of a peak**. The vaguely 19th-century, nautical-almanac tone also
suits the newspaper-masthead visual identity (see `DESIGN.md`). This naming and its rationale are
the branding decision of record — the design system (ADR-8/9/11 in `DECISIONS.md`) already carries
the "Meridian" wordmark through the UI masthead, login, and page title.

## Target customer

Self-directed retail investors who actively manage their own portfolio of individual stocks —
typically 5–50 positions held for weeks to years, researched personally rather than delegated
to an advisor or an index fund. They already use a broker app to execute, but do their thinking
elsewhere: free screener sites, YouTube, news feeds, and a spreadsheet for cost basis and P/L.
Comfortable with web tools; often hold positions in more than one currency (the product's base
display currency switch and FX conversion serve exactly this user).

Explicitly NOT the target:
- **Day traders / scalpers** — the product has no real-time push updates or trade execution.
- **Purely passive index investors** — they don't research individual stocks, which is the
  product's core differentiator.
- **Professional/institutional users** — no multi-user portfolios, sharing, or collaboration.

## Problem

A DIY stock investor's workflow is fragmented across four or five tools that don't talk to each
other: the broker shows holdings but little research; screeners show fundamentals but know
nothing about *your* positions or cost basis; valuation requires a DCF spreadsheet or a paid
terminal; news sentiment means reading everything yourself. The result is that most retail
investors either skip systematic research entirely or spend hours a week stitching it together
manually — and still can't answer basic questions like "what is my actual win rate?" or "is
this stock objectively cheap right now?"

Existing alternatives fall short in one direction each: portfolio trackers (broker apps,
spreadsheet templates) track but don't research; research tools (screeners, terminals) research
but don't track; and the terminals that do both are priced and designed for professionals.

## Positioning

Meridian is a personal portfolio tracker with a built-in research desk. Log your real buy/sell
transactions, see live-priced performance in your own base currency, and run automated
technical, fundamental, valuation, and news-sentiment analysis on any stock — owned or not —
in one place. Unlike broker apps it scores and values stocks for you; unlike screeners it knows
your positions, cost basis, and realized results; unlike terminals it's built and priced for an
individual investor, not a trading desk.

## Messaging

### Headline
Your portfolio and your research, finally in one place.

### Subheadline
Track every buy and sell, see live performance in your currency, and score any stock with
automated technical, fundamental, valuation, and sentiment analysis.

### Key value props (3–5)

1. **Know your real performance.** Average cost basis, realized P/L, win rate, average holding
   time, and full closed-position history — computed from your actual transactions, with CSV
   export and multi-currency display. *(Proof: portfolio + closed-position features, PRODUCT.md)*
2. **Research any stock in seconds.** A 7-level technical signal built from SMA/EMA, RSI, MACD,
   Bollinger Bands and more, a weighted fundamental score across ~25 metrics, and analyst
   ratings — for any symbol, whether you own it or not. *(Proof: Research capabilities, PRODUCT.md)*
3. **Know what a stock is actually worth.** Five intrinsic-value methods (DCF Lite, Graham
   Number, PEG-Adjusted, P/E and P/B Multiples) confidence-weighted into a single fair-value
   estimate, from Significantly Undervalued to Significantly Overvalued. *(Proof: Intrinsic
   value, PRODUCT.md)*
4. **AI that reads the news for you.** Sentiment-scored news per symbol with daily history, plus
   a daily AI-generated portfolio insight covering risks, opportunities, and recommendations.
   *(Proof: news sentiment + daily insight features, PRODUCT.md)*
5. **A watchlist that thinks.** Up to 50 stocks with a composite score blending fundamentals,
   technicals, analyst views, sentiment, and intrinsic value — flagged when your target price
   is reached. *(Proof: Wishlist, PRODUCT.md)*

### Tone of voice
- Plain-spoken and numerate: talk like a smart friend who reads 10-Ks, not like a trading guru.
- Show, don't hype: concrete numbers and screenshots over superlatives. Never promise returns.
- **Always "analysis, not advice":** every marketing asset carries the framing that the product
  scores and informs — the decision is the user's. No "buy this stock" language, ever.
- Honest about limits: prices are fetched on sync, not streamed; positions are self-reported;
  no brokerage connection. Say so plainly — it builds trust with this audience.

## Pricing

**Model: freemium subscription.** Tracking is free forever (it's the acquisition hook and has
near-zero marginal cost); the research and AI layer is the paid product (it carries real
per-user API costs — market data and Gemini calls — and is the differentiated value).

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | €0 | Full portfolio tracking: positions, buy/sell transactions, cost basis, realized P/L, performance history, closed-position stats, CSV export, currency switch. Limited research: a small daily quota of full stock analyses. Wishlist capped at 10 stocks. |
| **Investor** | €7.99/mo or €79/yr (2 months free) | Everything in Free, plus: unlimited research (technical, fundamental, analyst, intrinsic value), news sentiment with daily history, AI daily portfolio insight, full 50-stock wishlist with composite scores and target-price flags. |

**Rationale**
- The free tier must be genuinely useful standalone (a real tracker), or the funnel dies —
  but the daily-research quota lets every free user *taste* the paid differentiator.
- €7.99/mo sits in the consumer-fintech comfort band (€5–15/mo), far below pro data terminals,
  and is defensible against per-user API costs concentrated in the paid tier.
- Annual plan (€79 ≈ 2 months free) to front-load cash and reduce churn.
- **Launch pricing:** free for all beta users; first 100 paying customers get a permanent
  founding-member rate (e.g. €4.99/mo) in exchange for feedback and testimonials.

**Dependency (not a decision this role can make):** no billing, entitlements, or quota
enforcement exists in the codebase today — the tier split above is packaging strategy, and
gating features requires a Planner + Coding agent effort before any paid launch.

## Channels

Ranked by expected ROI for a solo founder with more time than budget:

1. **SEO / content marketing (owned — highest long-term ROI).** The product's research angle
   maps directly onto high-intent search queries ("how to calculate intrinsic value",
   "portfolio tracker with cost basis", "Graham Number calculator"). Publish method explainers
   that mirror the product's actual analysis methods. Slow to compound; start immediately.
2. **Investing communities (earned).** Reddit (r/stocks, r/investing, r/dividends,
   r/EuropeFIRE, r/eupersonalfinance), FinTwit/X, and Bogleheads-adjacent forums where DIY
   investors compare tooling. Participate genuinely; share the product only where tool
   recommendations are welcome. Low cost, high trust, high ban-risk if done lazily.
3. **Launch platforms (earned, one-shot).** Product Hunt, Hacker News "Show HN", BetaList.
   Good for an initial signup spike and backlinks; not a durable channel.
4. **Creator partnerships (earned/paid).** Small-to-mid retail-investing YouTubers and
   newsletter writers (10k–100k audience). Offer free Investor accounts first; paid
   sponsorships only after organic conversion data exists.
5. **Email (owned).** Waitlist pre-launch; post-signup onboarding sequence driving the two
   activation actions (add a position, run a research analysis); weekly digest later.
6. **Paid search & social (paid — last).** Google Search on high-intent keywords
   ("stock portfolio tracker", "stock intrinsic value calculator") and Reddit ads. Do not
   spend until activation and retention are measured and acceptable — paid traffic into a
   leaky funnel is burned money.

## Launch plan

| Phase | Timing | What | Owner |
|-------|--------|------|-------|
| **0 — Private beta** | Now → +4 weeks | Landing page + waitlist live; 20–50 beta users recruited from personal network and communities; instrument signup → activation funnel; collect testimonials; fix the top friction points | Founder (+ Coding agent for instrumentation) |
| **1 — Public launch** | Weeks 5–8 | Product Hunt + Show HN + BetaList on one coordinated day; launch blog post; founding-member offer live; daily community engagement during launch week | Founder |
| **2 — Content engine** | Months 2–6 | 1–2 SEO articles/week mirroring the product's analysis methods; 3–5 creator partnerships; email digest | Founder (GTM expert role for copy) |
| **3 — Paid tests** | Month 4+ (gated) | Only if D30 retention and free→paid conversion clear targets: €500/mo test budget on Google Search, then Reddit ads | Founder |

---

## Marketing & advertising plan

Campaign brief for the public launch (Phase 1), built on the objective/audience/message/
channel/measure framework.

### Campaign overview
- **Campaign name:** "One Place" launch campaign
- **Summary:** Position the product as the first tool that puts a DIY investor's portfolio
  tracking and stock research in one place, and convert launch-week attention into activated
  free users and founding-member subscribers.
- **Primary objective (SMART, targets are assumptions to confirm):** 500 signups with ≥40%
  activation (user adds ≥1 position AND runs ≥1 stock analysis) within 8 weeks of public launch.
- **Secondary objectives:** 100 waitlist emails pre-launch; 25 founding-member conversions;
  top-10 Product Hunt day placement.

### Audience profile
Self-directed retail investor managing their own stock portfolio who is struggling with
research and tracking fragmented across broker, screeners, and spreadsheets, and looking for
one tool that ties systematic analysis to their actual positions. They discover tools through
Reddit, YouTube, FinTwit, and Google searches, and care most about data credibility, honest
limitations, and not being sold "guru" advice. Buying stage: problem-aware, solution-shopping.

### Key messages
- **Core:** Your portfolio and your research, finally in one place.
- **Supporting** (each maps to a value prop above, with the product feature as proof point):
  1. Stop guessing your performance — real cost basis, realized P/L, and win rate from your
     actual transactions.
  2. Score any stock in seconds — technical, fundamental, analyst, and intrinsic-value analysis
     without a terminal subscription.
  3. Five valuation methods, one fair-value answer.
  4. AI reads the news and your portfolio daily, so you don't have to.
- **Channel variations:** HN/Reddit copy leads with methodology transparency and limitations
  (this audience punishes hype); Product Hunt copy leads with the all-in-one convenience;
  email copy leads with the activation actions.
- **Compliance rule for every asset:** analysis-not-advice framing, no return promises, no
  "buy/sell this stock" calls in marketing.

### Channel plan (launch window)

| Channel | Why | Format | Effort | Budget share |
|---------|-----|--------|--------|--------------|
| Product Hunt + Show HN + BetaList | One-day attention spike from tool-curious early adopters | Launch post, demo GIF/video, founder comment thread | Medium | €0 |
| Reddit communities | Highest trust concentration of exact ICP | Genuine "I built this" posts where allowed, comment participation | Medium | €0 |
| Landing page + blog | Conversion surface + SEO foundation | Launch post, 4 method-explainer articles | Medium | €0 |
| Email (waitlist → onboarding) | Owned; drives activation, not just signups | 3-email launch sequence, 4-email onboarding sequence | Low | €0 (tool cost only) |
| X / FinTwit | Founder-audience building, launch amplification | Build-in-public thread, launch thread | Low | €0 |
| Paid search (Phase 3, gated) | High-intent capture once funnel is proven | Search ads on tracker/valuation keywords | Medium | €500/mo test |

### Content calendar (8 weeks around launch)

| Week | Content piece | Channel | Notes | Status |
|------|--------------|---------|-------|--------|
| −2 | Landing page copy finalized + waitlist | Website | Blocks everything else | todo |
| −2 | Demo video/GIF (add position → research a stock) | PH / website | Shows both halves of positioning | todo |
| −1 | Launch blog post: "Why I built a tracker with a research desk" | Blog / HN | Doubles as Show HN body | todo |
| −1 | 3-email waitlist launch sequence written | Email | Send on launch day | todo |
| 0 | **Launch day:** PH + Show HN + BetaList + X thread + waitlist email | All | Founder in comments all day | todo |
| 1 | Method explainer #1: "How our 7-level technical signal works" | Blog / Reddit | Mirrors implemented feature | todo |
| 2 | Method explainer #2: "Five intrinsic-value methods, one estimate" | Blog | SEO: valuation keywords | todo |
| 3 | Onboarding email sequence live (4 emails → activation) | Email | Targets the 40% activation goal | todo |
| 4 | Method explainer #3: "What ~25 fundamental metrics actually tell you" | Blog | | todo |
| 5 | Creator outreach: 10 investing YouTubers/newsletters offered free Investor accounts | Partnerships | | todo |
| 6 | Method explainer #4: "Reading news sentiment with AI" | Blog | | todo |
| 7–8 | Launch retro: metrics review, decide Phase 3 paid gate | Internal | Compare against KPIs below | todo |

### Content assets needed
Must-have: landing page copy, demo video/GIF, launch blog post, PH listing copy, Show HN post,
waitlist sequence (3 emails), onboarding sequence (4 emails). Nice-to-have: 4 method-explainer
articles, X build-in-public thread, creator outreach one-pager.

### Success metrics
- **Primary KPI:** activated signups (added ≥1 position AND ran ≥1 analysis) — target 200
  (500 signups × 40%) by week 8.
- **Secondary:** signups (500), waitlist size pre-launch (100), founding members (25),
  D30 retention (≥25%), launch-day PH rank (top 10), organic search impressions on method
  articles (directional).
- **Tracking:** requires basic product analytics (signup, first-position, first-analysis
  events) — **not currently instrumented; a Phase 0 dependency for the Coding agent.**
- **Cadence:** weekly during weeks 0–8; the week 7–8 retro gates paid spend.

### Budget
Assumed solo-founder budget: **€0 media spend through Phase 2**; time is the main cost.
Phase 3 test budget €500/mo (assumption to confirm), allocated ~70% Google Search /
~15% Reddit ads / ~15% contingency, continued only if blended cost per activated user is
sustainable against the €79/yr price point.

### Risks and mitigations
1. **Crowded category** (many "portfolio trackers") → lead every asset with the research desk +
   intrinsic value differentiator, not generic tracking.
2. **Compliance/trust perception** (financial product, AI recommendations) → analysis-not-advice
   disclaimer on site and in-product; marketing never promises returns; honest-limits tone.
3. **Free-tier API cost blowout** (research and AI calls cost money per use) → daily research
   quota on Free from day one; monitor per-user API cost weekly.
4. **Solo-founder bandwidth** → all launch assets produced before launch day; content batched;
   Phase 3 gated so paid ads never run unattended into a broken funnel.
5. **Community backlash to self-promotion** → follow each subreddit's self-promo rules; lead
   with methodology content, not links.

---

## Assumptions [REQUIRES CONFIRMATION]

Approving this file approves these; correcting any of them changes the plan:

1. **Commercial intent:** the product is being taken to market as a paid consumer product
   (not kept as a personal/portfolio project).
2. **Geography & currency:** EUR pricing, Europe-first audience (inferred from the
   multi-currency feature; unconfirmed).
3. **Price points:** €7.99/mo · €79/yr · €4.99 founding rate are positioning judgments, not
   tested prices.
4. **Targets:** 500 signups / 40% activation / 25 founding members / €500/mo paid test budget
   are unvalidated planning numbers.
5. **Free-tier research quota** exists as strategy only — no quota, billing, or entitlement
   code is implemented (see Pricing dependency).
6. **Timeline:** Phase 0 starting now (2026-07-17) with public launch in weeks 5–8.
