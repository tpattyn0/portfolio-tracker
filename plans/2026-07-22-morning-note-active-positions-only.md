# Plan: Morning note covers only current holdings (drop closed positions)

Date: 2026-07-22

## Problem

The daily portfolio insight ("morning note") still mentions closed positions — e.g. Argenx, a
position that has been fully sold. The note is meant to speak only about the current portfolio
(the positions the user still holds), not positions that were exited.

**Root cause (confirmed in code):** when a position is fully sold, the sell route
(`app/api/portfolio/positions/[ticker]/sell/route.ts:137-146`) sets the `Position` row's
`quantity` to `0` but **never deletes the row** — a fully-sold position persists as a
`quantity: 0` record (this is documented, intentional behaviour: see `AGENT.md`'s Positions-tab
fragile-surface entries and ADR-18). The insights route
(`app/api/insights/portfolio/route.ts:12-15,34`) loads `portfolio.positions` with **no filter**
and feeds `positions.map(p => p.ticker)` into the Gemini prompt (line 81). So every
fully-sold-but-not-deleted position (Argenx included) leaks into the prompt and the model writes
about it.

This is a single missed filter, not a systemic issue. The app already has an established
convention for "current holdings only": filter positions by `quantity: { gt: 0 }`. The main
portfolio route already does exactly this at the Prisma-include level
(`app/api/portfolio/route.ts:19-22`, comment "Only get positions with quantity > 0"), and the
sell route's own portfolio-total recalc filters `quantity: { gt: 0 }`
(`sell/route.ts:149-154`). The insights route is the one place that omits it.

## Approach

Apply the existing active-positions convention to the insights route: only positions with
`quantity > 0` should reach the Gemini prompt. Filter at the Prisma query so the "empty
portfolio" branch (`positions.length === 0`, route lines 36-45) also behaves correctly when the
only remaining rows are closed positions — a portfolio that has been fully exited should produce
the "No positions in portfolio to analyze" response, not a note about ghosts.

**Chosen implementation — filter in the Prisma `include`**, mirroring
`app/api/portfolio/route.ts:19-22` exactly:

```ts
const portfolio = await prisma.portfolio.findUnique({
  where: { userId: auth.userId },
  include: {
    positions: {
      where: { quantity: { gt: 0 } },
    },
  },
});
```

Rationale for filtering at the query rather than post-fetch (`.filter(p => p.quantity > 0)`):
it matches the app's existing pattern one-to-one (single source of convention, easy to review),
and `position.quantity` is a Prisma `Decimal` — a JS `p.quantity > 0` comparison on a Decimal is
a footgun the query-level filter avoids entirely.

**Cache interaction (important, and why this is safe):** insights are cached once per user per
day in `PortfolioInsight` (route lines 21-32, `userId_date` unique key). A note generated *today*
that already mentions Argenx will be returned from cache until tomorrow regardless of this code
change — the fix changes generation, not stored rows. This is acceptable and expected: no
backfill or cache purge is in scope (see Assumptions). The corrected note appears on the next
day's first request, or immediately if today's row does not yet exist for the user. We do **not**
delete existing `PortfolioInsight` rows (guardrail: never clear persisted data outside an
approved task; and a one-day-stale note is not worth a destructive op).

**Out of scope (deliberately):** changing whether the sell route deletes fully-sold positions.
That `quantity: 0` retention is load-bearing elsewhere — the closed-positions history and the
Positions tab both rely on the row and its transactions still existing (ADR-5, ADR-18,
`AGENT.md`). Deleting the row to fix the morning note would break closed-position history. The
correct fix is filtering at the read site, exactly as the rest of the app already does.

## Tasks

1. [x] Filter the insights route's position load to `quantity > 0` — in
   `app/api/insights/portfolio/route.ts`, add `where: { quantity: { gt: 0 } }` to the
   `positions` include (mirroring `app/api/portfolio/route.ts:19-22`). No other logic changes;
   the existing `positions.length === 0` branch now correctly triggers for a fully-exited
   portfolio.
   — Acceptance: reading the route, the `findUnique` include filters positions by
   `quantity: { gt: 0 }`; `positions.map(p => p.ticker)` (prompt line ~81) can no longer include
   a `quantity: 0` ticker.

2. [x] Add a regression test at `app/api/insights/portfolio/route.test.ts` following the existing
   route-test mocking pattern (`vi.mock("@/lib/prisma")`, `vi.mock("@/lib/utils/auth")`, as in
   `app/api/portfolio/positions/[ticker]/sell/route.test.ts` and
   `app/api/portfolio/route.test.ts`). Cover: (a) **happy path / core regression** — a portfolio
   whose held position is AAPL (`quantity > 0`) and whose Argenx position is closed
   (`quantity: 0`); assert the mocked `prisma.portfolio.findUnique` is called with the
   `quantity: { gt: 0 }` filter, and — since the mock honours that filter and returns only the
   held row — assert the ticker list handed to generation contains AAPL and not the closed
   ticker. (b) **failure/edge case** — a portfolio where the *only* rows are closed
   (`quantity: 0`), i.e. the filtered set is empty: assert the route returns the
   `"No positions in portfolio to analyze"` response and does **not** call Gemini. Stub/avoid the
   real Gemini call (no `GEMINI_API_KEY` in the test env → the route's "not configured" branch,
   or mock `@google/generative-ai`) so the test never hits the network — assert on the
   ticker set passed to the prompt, or on the `positions.length === 0` short-circuit, not on model
   output.
   — Acceptance: `npx vitest run app/api/insights/portfolio/route.test.ts` passes; the test fails
   if the `quantity: { gt: 0 }` filter is removed from the route.

3. [x] Documentation: add a one-line note to `PRODUCT.md`'s AI-generated daily insight bullet
   (line 26) clarifying the note covers current holdings only, and add an `AGENT.md`
   known-fragile-surface entry recording that any read of `portfolio.positions` intended to
   represent "current holdings" must filter `quantity > 0` (fully-sold positions are retained as
   `quantity: 0` rows by design; the insights route regressed on this). No new ADR is warranted —
   this is a bug fix that applies an existing, already-decided convention (ADR-5's retained-rows
   model), not a new decision.
   — Acceptance: `PRODUCT.md` and `AGENT.md` reflect the change; `AGENT.md` entry names the
   `quantity > 0` invariant for "current holdings" reads.

## Files to create or modify

- `app/api/insights/portfolio/route.ts` — add the `quantity: { gt: 0 }` position filter (Task 1).
- `app/api/insights/portfolio/route.test.ts` — new regression test (Task 2).
- `PRODUCT.md` — clarify the daily insight covers current holdings only (Task 3).
- `AGENT.md` — new fragile-surface entry for the "current holdings" `quantity > 0` invariant
  (Task 3).

## Verification

The `## Verify` block in `AGENT.md` (`npm run verify`) runs typecheck + lint + tests + secret
scan and must pass. Beyond it:

- **Manual check (UI):** on the dashboard, with a portfolio that has at least one held position
  and at least one fully-sold position (e.g. Argenx), the morning note must not mention the sold
  ticker. Because insights are cached per user per day, verify against a user whose
  `PortfolioInsight` row for today does not yet exist (or verify on the day after deploy) — a note
  generated before this change is served from cache and is expected to still mention the old
  position until it regenerates. This is a generation fix, not a cache rewrite.
- **Edge case:** a portfolio consisting only of fully-sold positions must produce the
  "No positions in portfolio to analyze" response, not a note about the exited holdings.

## Assumptions

- **No backfill / cache purge of existing `PortfolioInsight` rows.** Today's already-generated
  note (mentioning Argenx) is left in place and expires naturally at the next day's first
  request. Rationale: the guardrail against clearing persisted data outside an approved task, and
  a one-day-stale note not being worth a destructive DB op. If the owner wants the current note
  corrected immediately, that is a separate, explicitly-scoped task (delete today's
  `PortfolioInsight` row for the affected user so the next request regenerates) — not folded into
  this fix.
- **The morning note should reflect only currently-held positions, full stop** — no separate
  "recently closed" section is wanted. The task statement ("should only speak of the portfolio
  itself, not of the closed positions") is read as: closed positions are excluded entirely, not
  summarised elsewhere in the note. If a "positions you recently exited" summary is desired, that
  is a new feature, not this bug fix.
- **`quantity: 0` remains the correct signal for "closed."** Consistent with the sell route
  (never deletes the row), the closed-positions route, and the Positions-tab helpers
  (`getPositionsPanelState`). No new "closed" flag column is introduced.
