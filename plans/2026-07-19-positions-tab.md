# Plan: Positions tab — held stocks keep the general market header; position detail moves into a conditional "Positions" tab

Date: 2026-07-19

## Problem

The stock detail page shows a different header depending on which route the user
lands on, and when a user holds a stock they lose the general market context
(current price / day range / 52-week range / market cap):

- **Held stock, reached from the dashboard** → `app/(dashboard)/portfolio/[ticker]/page.tsx`.
  Header is **position-centric**: Market value / Unrealized P/L / (Realized P/L) /
  Today's change / Avg cost. General market stats are **never shown** on this route.
  Back-link: "← Back to dashboard". Actions: Buy more / Sell / Delete. (Engie screenshot.)
- **Any stock, reached from the research desk or watchlist** → `app/(dashboard)/research/[symbol]/page.tsx`.
  Header is the **general market** grid: Current price / Day range / 52-week range /
  Market cap. Back-link: "← The research desk". Actions: Watchlist / Add to portfolio.
  (Biotalys screenshot.)

These are **two distinct routes**, each with its own full 7-tab bar, not one component
with a header branch (verified: `portfolio/[ticker]/page.tsx:22-30` and
`research/[symbol]/page.tsx:46-54` each declare their own `tabs` array). A held stock
therefore renders with the general header on `/research/[symbol]` but the position
header on `/portfolio/[ticker]` — the general market info disappears specifically on
the dashboard-reached view.

The owner wants: the **general market header stays visible for held stocks**, and the
**position-specific detail** (shares, avg cost, market value, unrealized P/L) moves
into a tab that is **renamed "Positions"** and shown **only when the user has or had a
position** in that symbol.

## What the code already does (so we don't rebuild it)

- `research/[symbol]` already renders the general market header
  (`research/[symbol]/page.tsx:149-182`) and already has a Transactions tab wired to
  the shared `components/research/transactions-tab.tsx`, which **already** shows an
  active-position stat panel (Shares held / Average cost / Market value / Unrealised
  P/L, `transactions-tab.tsx:80-104`) above the transaction table, plus a "You do not
  hold {symbol}" empty state (`transactions-tab.tsx:68-78`). So on `research/[symbol]`,
  the owner's desired end-state is ~90% already in place — it only needs the tab
  **renamed** and made **conditional**.
- The general market stats come from `GET /api/market/quote/[ticker]`
  (`lib/services/market-data.service.ts:70-79` supplies `dayHigh/dayLow/yearHigh/
  yearLow/marketCap`). **The `portfolio/[ticker]` page already fetches this exact
  quote** (`portfolio/[ticker]/page.tsx:63-72`) — it just doesn't render the general
  grid. **No new query or service is needed** to add the general header there.
- "Has or had a position" is best determined by **transactions existing for the
  ticker**, not by a live Position row:
  - A full sell keeps the `Position` row at `quantity: 0` and retains its
    `Transaction` rows (`sell/route.ts` updates `quantity` to the remainder, never
    deletes). So a closed-but-not-deleted position still has transactions.
  - `GET /api/portfolio/transactions?ticker=<sym>` is scoped by `portfolioId` + `ticker`
    (`transactions/route.ts:16-26`), so it returns rows regardless of whether a live
    `Position` exists — the correct "has or had" signal.
  - Caveat: **Delete** (`positions/[ticker]/route.ts:79-107`) removes the position and
    its transactions, so a deleted position leaves no trace and the tab correctly
    disappears. This matches the intent ("delete = gone").
- `components/research/transactions-tab.tsx`'s active-position panel is driven by
  `GET /api/portfolio/positions/[ticker]` (404 = not held). This shows the panel only
  for a **currently-held** position (quantity > 0 via the position record), while the
  transaction table shows regardless. That is the desired behaviour: closed positions
  show history (table) but no live stat panel (nothing to value live).

## Approach

Honor the owner's intent with the **minimum divergence and zero functionality loss**,
applied **consistently to both routes**:

### Decision: keep both routes, align their behaviour (recommended)

Rather than consolidating `/portfolio/[ticker]` into `/research/[symbol]` (see
Open decisions — that is a larger call), keep both routes but make them behave the
same way the owner describes:

1. **`research/[symbol]` (general header already correct):**
   - Rename the "Transactions" tab label to **"Positions"**.
   - Show the Positions tab **only when transactions exist** for the symbol (has-or-had).
     When none exist, drop the tab entirely (a never-transacted stock shows 6 tabs).
   - The tab body (`TransactionsTab`) is already correct; no body change needed beyond
     the empty-state copy, which becomes unreachable once the tab is conditional (the
     "you do not hold" state only applied when the tab was always shown — keep it as a
     defensive fallback for the *held-then-fully-sold* case where a live position is
     absent but transactions exist).

2. **`portfolio/[ticker]` (the route that currently hides the general header):**
   - **Replace the position-centric header grid with the general market grid**
     (Current price / Day range / 52-week range / Market cap) — the same JSX
     `research/[symbol]/page.tsx:149-182` uses, fed by the `quote` this page already
     fetches. The general market info stops disappearing for held stocks.
   - **Relocate the position stats** (Market value / Unrealized P/L / Realized P/L /
     Today's change / Avg cost) out of the header and into the renamed **"Positions"**
     tab. To avoid maintaining two position panels, switch this route's Positions tab
     body from the legacy `components/transaction-history.tsx` (a stock-shadcn `Card`
     table, off-design) to the shared **`TransactionsTab`** used by `research/[symbol]`,
     which already renders the position stat panel + transaction table in the Meridian
     editorial shell.
   - **Preserve the position actions** that only exist here: Buy more / Sell / Delete
     buttons and the Buy more / Sell modals stay in the header action row (they are
     position operations, appropriate next to the company name). This is why we do NOT
     simply redirect to `research/[symbol]` (which has no such actions).
   - Rename the tab label to **"Positions"**; since this route is only ever reached for
     a held/closed position, the tab is effectively always present here — but apply the
     same has-transactions guard for correctness (a position with zero transactions is
     not a real state, but the guard is cheap and keeps both routes identical).

### Net effect

- A held stock reached from the dashboard (`/portfolio/[ticker]`) now shows the
  **general market header** (matching the Biotalys layout) with Buy more / Sell /
  Delete actions, and its **Positions tab** carries the market value / unrealized P/L /
  avg cost / shares panel + the transaction table.
- The same stock reached from research (`/research/[symbol]`) is unchanged in header,
  gains the renamed conditional **Positions** tab.
- A never-transacted stock (research only) shows **no Positions tab**.
- The two routes now present position detail through one shared component
  (`TransactionsTab`), removing the legacy `transaction-history.tsx` divergence.

### Shared-component detail: relocating position actions is out of scope

Buy more / Sell / Delete remain in the `portfolio/[ticker]` header. The `TransactionsTab`
body is not given these actions (it already has a "+ Add transaction" pill that deep-links
to `/portfolio/add`). Keeping the mutating actions in the header, unchanged, keeps this a
UI-relocation change with no touch to the sell/buy/delete flows or their fragile FIFO code
(`AGENT.md` fragile surfaces — sell route, realized-pl service). This is deliberate.

## Tasks

1. [x] **Rename the tab label to "Positions" and gate visibility on transactions in
   `research/[symbol]/page.tsx`.** Add a transactions-count query (reuse the same
   `GET /api/portfolio/transactions?ticker=` the tab already calls, or lift it to the
   page and pass down) to compute `hasTransactions`. Filter the `tabs` array so the
   `transactions` entry (relabeled "Positions") is present only when `hasTransactions`.
   Guard `activeTab`: if the active tab becomes hidden (was on Positions, then it
   disappears — cannot happen mid-session here, but handle defensively), fall back to
   "overview". — **Acceptance:** on a symbol with transactions the 7th tab reads
   "Positions" and renders the position panel + table; on a never-transacted symbol
   only 6 tabs render and no "Positions"/"Transactions" tab appears.

2. [x] **Swap `portfolio/[ticker]` header from position grid to the general market
   grid.** Replace the position-centric quote card (`portfolio/[ticker]/page.tsx:222-276`)
   with the general market grid JSX from `research/[symbol]/page.tsx:149-182`, fed by the
   already-fetched `quote` (currency, price, change, dayLow/High, yearLow/High, marketCap).
   Keep the header company-name/kicker block and the Buy more / Sell / Delete action row
   unchanged. Keep the "← Back to dashboard" back-link (this route's origin). — **Acceptance:**
   `/portfolio/[ticker]` for a held stock shows Current price / Day range / 52-week range /
   Market cap (values populated from the live quote), and Buy more / Sell / Delete remain
   functional.

3. [x] **Move position stats into the Positions tab on `portfolio/[ticker]` by switching
   its tab body to the shared `TransactionsTab`.** Replace the `TransactionHistory`
   usage (`portfolio/[ticker]/page.tsx:329-333`) with `TransactionsTab` from
   `components/research/transactions-tab.tsx` (`symbol={position.ticker}`,
   `currency={baseCurrency}`). Rename the tab label to "Positions" and apply the same
   has-transactions guard as Task 1. — **Acceptance:** the Positions tab on
   `/portfolio/[ticker]` shows the Meridian position stat panel (Shares held / Average
   cost / Market value / Unrealised P/L) above the transaction table; the old
   `Card`-wrapped shadcn table is gone.

4. [x] **Handle the closed-position (quantity 0) case on both routes.** Confirm that a
   fully-sold position (Position row present, `quantity: 0`, transactions present) shows
   the Positions tab with the transaction table but a graceful panel: `TransactionsTab`
   currently shows the stat panel whenever `positionQ.data` is truthy — a quantity-0
   position record still returns 200, so the panel would show zeros. Decide and implement
   the intended presentation (Assumption A2): show the transaction table + a muted
   "Position closed" note, suppressing the live stat panel when `position.quantity === 0`.
   — **Acceptance:** a fully-sold-but-not-deleted symbol shows the Positions tab with the
   transaction history and no misleading zero-value live stat panel.

5. [x] **Remove or retire the now-unused legacy `components/transaction-history.tsx` if it
   has no remaining importer** (grep after Task 3). If another surface still imports it
   (e.g. a closed-positions view), leave it and note in the summary. — **Acceptance:**
   `grep -rn "transaction-history" app components` shows either no importers (then the file
   is deleted) or the remaining importer is named in the summary.

6. [x] **Tests.** Add/adjust unit tests for the tab-visibility logic (a pure helper
   `shouldShowPositionsTab(transactions)` or equivalent extracted from the pages, so it is
   testable without rendering) covering: has transactions → true; empty → false. Add a test
   for the closed-position panel-suppression rule from Task 4 (quantity 0 → panel hidden,
   table shown). — **Acceptance:** `npm run verify` passes; the new helper has happy-path
   and empty/closed cases covered.

Task status markers: [ ] todo · [~] in progress · [x] done · [!] blocked

## Files to create or modify

- `app/(dashboard)/research/[symbol]/page.tsx` — tab rename + conditional visibility (Task 1).
- `app/(dashboard)/portfolio/[ticker]/page.tsx` — general header swap (Task 2), tab body
  swap to `TransactionsTab` + rename + conditional (Tasks 3, 4).
- `components/research/transactions-tab.tsx` — closed-position panel suppression (Task 4);
  possibly extract the tab-visibility helper here or in a `lib/utils/` file for testing (Task 6).
- `lib/utils/positions-tab.ts` (new, optional) — pure `shouldShowPositionsTab` helper + its
  test `lib/utils/positions-tab.test.ts` (Task 6).
- `components/transaction-history.tsx` — delete if no importers remain (Task 5).

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs typecheck + lint + tests +
secret-scan and gates the commit. Beyond it, manual UI checks (Designer stage will spec
these; Coding agent should eyeball them):

- `/portfolio/[ticker]` for a held stock: general market grid populated, Buy more / Sell /
  Delete work, Positions tab shows position panel + transaction table.
- `/research/[symbol]` for a held stock: unchanged header, 7th tab reads "Positions".
- `/research/[symbol]` for a never-transacted stock: 6 tabs, no Positions tab.
- A fully-sold (quantity 0) symbol: Positions tab shows table, no zero-value stat panel.
- Currency reconversion still correct in the position panel (base-currency switch).

## Assumptions

- **A1 — "has or had a position" = transactions exist for the ticker.** Verified this is
  the only durable signal: closed positions keep `quantity: 0` + transactions; deleted
  positions remove both (so the tab correctly vanishes). The owner wrote "have or had", so
  closed-position history counts as YES for tab visibility.
- **A2 — closed (quantity 0) position shows the transaction table but suppresses the live
  stat panel** (market value / unrealized P/L of zero shares is meaningless). Table stays;
  a muted "Position closed" note replaces the panel. If the owner instead wants the panel
  to show final realized figures, that is a small follow-up.
- **A3 — position actions (Buy more / Sell / Delete) stay in the `portfolio/[ticker]`
  header**, not moved into the Positions tab. They are position operations that read best
  next to the company name, and moving them would touch the mutation flows unnecessarily.
- **A4 — both routes are retained** (not consolidated). See Open decisions for the
  alternative.
- **A5 — the general header on `portfolio/[ticker]` uses the same quote already fetched**;
  no new endpoint. If `quote` is briefly null (loading), the grid renders after the existing
  `quoteLoading` gate (`portfolio/[ticker]/page.tsx:131`), matching current behaviour.

## Open decisions

- **OD-1 — RESOLVED 2026-07-19 by owner: keep both routes, align behaviour (Option B).**
  The plan below (Option B) is approved as-is; Option A (consolidation) is logged in
  `future_ideas.md` as a candidate. No task changes.

- **OD-1 (original text — architectural, now resolved above): consolidate the two
  routes, or keep both?** This plan keeps both routes and aligns their behaviour (Option B),
  because `/portfolio/[ticker]` owns position actions (Buy more / Sell / Delete + modals +
  Realized P/L) that `/research/[symbol]` does not. The alternative (Option A) is to redirect
  `/portfolio/[ticker]` → `/research/[symbol]` and migrate those actions into the research
  view's Positions tab, collapsing to one detail route. Option A is cleaner long-term (one
  route, no duplicated header/tab scaffolding) but is a larger change that touches the
  mutation flows and the dashboard/closed-positions link targets, and risks the fragile
  sell/FIFO surfaces (`AGENT.md`). **Recommendation: Option B now** (this plan), with Option A
  logged in `future_ideas.md` as a consolidation candidate. If the owner prefers Option A, the
  plan's Tasks change materially and should be re-planned.

## Notes for the Designer stage

This change is UI-touching; the Designer stage should spec the following against existing
`DESIGN.md` tokens/patterns — **no new tokens or components are expected**:

1. **General market header now shown for held stocks (`/portfolio/[ticker]`).** Reuse the
   existing **Research detail 4-col ruled quote grid** (DESIGN.md → Components → "Ruled stat
   band" / UX flows → "Research detail — tab-by-tab" step, and "Position detail" §Quote card):
   Current price / Day range / 52-week range / Market cap, `border-r border-line2` verticals,
   serif values, signed change via `--up`/`--dn`. This is the *same* grid `research/[symbol]`
   already uses — spec parity, not a new pattern. The header action row (Buy more / Sell /
   Delete pills) stays; spec confirms secondary pills use transparent + `--line` border, Delete
   uses primary `--btnbg`/`--btnfg` (matching current `portfolio/[ticker]` header).

2. **"Positions" tab label + conditional visibility.** The tab bar is DESIGN.md → Components →
   "Segmented tabs" (`flex gap-8 border-b`, 11px uppercase kicker, active = weight 600 + 2px
   `--ink` underline). Spec the relabel from "Transactions" → "Positions" and the rule that the
   tab is omitted entirely when the symbol has no transactions (never-transacted stock → 6-tab
   bar). Update DESIGN.md's tab enumeration (Components → "Segmented tabs" lists
   "…Intrinsic value · Transactions · News & sentiment" at DESIGN.md:588, and UX flows →
   "Research detail" at :715/:787) to "Positions", and note the conditional nature.

3. **In-tab layout: active-position stat panel + transaction table.** Already specified as the
   DESIGN.md → UX flows → "Research detail — tab-by-tab" item 6 (the "Transactions (new tab)"
   spec at :787-794): a bare 4-col ruled stat band (Shares held / Average cost / Market value /
   Unrealised P/L, banded `--up`/`--dn`) above the "Your transactions" card + table (Date / Type /
   Shares / Price / Fees / Total, Type cell using the **Outlined type badge**). Spec should:
   (a) rename this spec item from "Transactions" to "Positions"; (b) add the **closed-position
   (quantity 0)** state — table shown, stat band replaced by a muted "Position closed" caption
   (Assumption A2); (c) confirm the shared `TransactionsTab` component is now the single source
   for both `/portfolio/[ticker]` and `/research/[symbol]` (the legacy `transaction-history.tsx`
   shadcn `Card` table is retired).

## ADR (proposed — add to DECISIONS.md when implemented)

See the "Proposed DECISIONS.md entries" note below; the Coding agent should add ADR-18 when
Tasks 1-3 land, since this changes which header a held stock shows and unifies the two routes'
position-detail rendering on one shared component.
