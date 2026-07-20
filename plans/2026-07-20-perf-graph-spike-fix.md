# Plan: Dashboard performance graph — remove the spurious 2026-07-17 spike (same-day tx double-count)

Date: 2026-07-20

## Problem

The dashboard performance chart shows a single giant isolated spike on 2026-07-17: the
series sits flat at ~€2,300 for the month, jumps to €5,373.59 on 2026-07-17, then drops
back to ~€3,120 on 2026-07-20. A portfolio does not double and halve in two days with a
flat line on either side — this is a bad data point.

The axis-scaling bug (`plans/2026-07-20-small-visual-fixes.md`, Issue 4) is already fixed
and is **not** in scope here — the y-axis labels now correctly bracket the plotted line,
which is precisely what makes the bad €5,373 point visible. This plan fixes the **data**,
not the rendering.

### Root cause (verified against live data, not guessed)

The spike is a **transient one-bucket double-count caused by comparing transaction
`executedAt` timestamps of inconsistent time-of-day against a midnight-anchored day
bucket**. It is NOT an FX bug and NOT a bad provider price.

The owner's portfolio has these transactions (probed from the real DB):

| Ticker | Type | `executedAt` | Qty |
|---|---|---|---|
| ARGX.BR | BUY | `2026-05-05T00:00:00.000Z` | 3 |
| NVDA | BUY | `2026-07-17T00:00:00.000Z` | 10 |
| ENGI.PA | BUY | `2026-07-17T00:00:00.000Z` | 50 |
| ARGX.BR | SELL | `2026-07-17T`**`07:50:00.120Z`** | 3 |

On 2026-07-17 the portfolio was rotated: ARGX.BR was fully sold and the proceeds went
into NVDA + ENGI.PA. The correct value that day is NVDA + ENGI ≈ €3,117, not
ARGX + NVDA + ENGI = €5,373.

In `app/api/portfolio/performance/route.ts`, for date-keyed ranges (1M/3M/6M/YTD/1Y/5Y/
10Y/FROM_START, `key === 'date'`) the price series is collapsed into day buckets whose
timeline key is UTC **midnight** (`Date.UTC(y, m, d)` → `2026-07-17T00:00:00.000Z`). The
cumulative-quantity two-pointer loop (route lines 176–183) then advances holdings with:

```
while (idx < txs.length && txs[idx].date.getTime() <= t) { cum += txs[idx].qtyDelta; idx++; }
```

where `t` is that midnight bucket timestamp. The result is asymmetric for same-day
transactions:

- NVDA BUY / ENGI BUY at `00:00:00` → `00:00:00 <= 00:00:00` is **true** → both counted (qty 10 / 50).
- ARGX SELL at `07:50:00` → `07:50:00 <= 00:00:00` is **false** → the sell is **not** counted → ARGX still shows qty 3.

So for exactly the 2026-07-17 bucket, ARGX (€2,256) is double-counted alongside the two
positions that replaced it (NVDA €1,775 + ENGI €1,343) = €5,373.59 — the exact peak in
the screenshot. On 2026-07-20 the SELL finally satisfies `<=`, ARGX drops to 0, and the
total settles to the correct ~€3,120. Hence the isolated one-day mountain that returns to
baseline.

The reason the two BUYs and the SELL differ is that BUYs were entered as date-only
(midnight) while the SELL carries an intraday time — the portfolio's `executedAt` values
mix "date-only" and "real intraday" timestamps, and the day-bucket comparison is not
robust to that mix.

FX is a red herring here: NVDA's 0.875 USD/EUR rate is applied uniformly to NVDA on every
point (including the correct 2026-07-20 point), so it is not the cause. All Yahoo daily
closes in the window are normal (ARGX ~750–830, NVDA ~195–212, ENGI ~26–27) — no garbage
provider price. This is entirely our own bucketing bug.

### Verification of the fix direction (already probed)

Re-running the exact route algorithm but comparing each transaction against the **end of
its bucket day** (`23:59:59.999Z`) for date-keyed ranges makes all of a day's
transactions — BUYs and SELLs alike — apply to that day's bucket. Probe output:

- 2026-07-17 becomes **€3,117.59** (NVDA + ENGI only; ARGX correctly 0) — spike gone.
- Every other point is unchanged; the series becomes a smooth flat-then-single-step curve
  (~€2,300 while holding ARGX → ~€3,120 after the 07-17 rotation).

## Approach

**Fix the cumulative-quantity boundary so all of a calendar day's transactions land in
that day's bucket for date-keyed ranges.** The cleanest, lowest-risk change:

1. **Extract the series-building math into a pure, testable function** in a new
   `lib/services/portfolio-performance.ts` (e.g. `buildPerformanceSeries(inputs)` taking
   already-fetched `priceBySymbol`, `txBySymbol`, `symbols`, `symbolCurrency`,
   `exchangeRates`, `timeline`, and the `key` discriminator; returning
   `{ date, value }[]`). The route keeps all I/O (auth, Prisma, Yahoo, FX fetch) and calls
   this function. This is the standard ADR-3 shape (routes thin, logic in a service) and is
   what lets us unit-test the spike scenario without network/DB. No behavior change from the
   extraction itself — it is a pure move plus the boundary fix below.

2. **Inside that function, normalize the quantity-timeline comparison to the bucket's end
   when `key === 'date'`.** For a date bucket keyed at UTC midnight, compare each
   transaction against `end-of-that-UTC-day` (`23:59:59.999`), so a same-day SELL at
   07:50 is counted in the same bucket as same-day BUYs at 00:00. For intraday ranges
   (`key === 'datetime'`, 1D/1W) the timeline points are real intraday timestamps and the
   existing direct `executedAt <= t` comparison is already correct — leave that path's
   comparison unchanged (compare against the point itself, not an end-of-day). The function
   therefore derives the comparison instant from `key`: `key === 'date'` → end-of-UTC-day
   of the bucket; `key === 'datetime'` → the point's own timestamp.

   This only affects **which bucket a transaction is attributed to**; it does not change
   prices, FX, forward-fill, or any other math. The forward-fill of prices (route lines
   202–208) is left exactly as-is — it is correct and not implicated.

### Why this fix over the alternatives

- **Not an FX change** — FX is already uniform and correct; touching it would fix nothing
  and risk regressing the (correct) USD conversion.
- **Not an outlier/clamp filter** — the spike is our own deterministic double-count, not a
  provider garbage point, so masking it with a "reject a point that deviates > Nx from its
  neighbours" guard would hide a real bug behind a heuristic and could suppress genuine
  large same-day moves (e.g. a real large rotation). CLAUDE-guidance and the task both
  prefer fixing the computational cause. No outlier policy is introduced, so **no ADR is
  needed** — this is a straightforward bucketing bug fix, not a non-obvious decision.
- **End-of-day boundary, not "strip time from `executedAt`"** — normalizing the *bucket
  comparison instant* is localized to the date-keyed series path and leaves the intraday
  path and the stored transaction data untouched; rewriting `executedAt` values or
  date-flooring every transaction would be a broader, data-touching change with more blast
  radius for no added correctness.

## Tasks

1. [ ] Extract series-building into `lib/services/portfolio-performance.ts` as a pure
   `buildPerformanceSeries(...)` function; update `app/api/portfolio/performance/route.ts`
   to call it, keeping all auth/Prisma/Yahoo/FX I/O in the route. No behavior change in
   this step (straight move). — Acceptance: `npm run verify` green; the route still returns
   `{ range, start, end, interval, series }`; diff shows the loop logic moved verbatim
   (aside from Task 2's boundary change) with the route now delegating.

2. [ ] In `buildPerformanceSeries`, change the cumulative-quantity two-pointer comparison so
   that for `key === 'date'` each transaction is compared against the **end of the bucket's
   UTC day** (`23:59:59.999`), and for `key === 'datetime'` against the point's own
   timestamp (unchanged behavior). — Acceptance: unit test in Task 3 passes; manual re-run
   of the 1M range for the owner's portfolio no longer shows the 2026-07-17 point above the
   two-position total (see Verification).

3. [ ] Add `lib/services/portfolio-performance.test.ts` with a fixture that **reproduces the
   spike**: three symbols where, on one date-keyed bucket day, two BUYs are timestamped at
   `T00:00:00Z` and a SELL of a third symbol is timestamped at `T07:50:00Z`, with prices
   such that the naive (midnight-boundary) computation double-counts the sold symbol.
   Assert: (a) the pre-fix boundary would have produced the inflated total (documented in
   the test as the bug being prevented), and (b) `buildPerformanceSeries` returns the
   correct total (sold symbol excluded) for that bucket. Add at least one intraday
   (`key === 'datetime'`) case asserting the intraday path is unchanged, and one
   no-same-day-overlap case asserting a plain BUY-then-hold series is untouched. —
   Acceptance: `npm run verify` green with the new tests; the spike-reproduction assertion
   fails if the boundary fix is reverted.

Task status markers: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

## Files to create or modify

- Create: `lib/services/portfolio-performance.ts` (pure `buildPerformanceSeries`).
- Create: `lib/services/portfolio-performance.test.ts` (spike-reproduction + intraday + hold-only cases).
- Modify: `app/api/portfolio/performance/route.ts` (delegate series building to the new function; remove the inline loop).
- Modify (docs, Coding-agent session): `ARCHITECTURE.md` (Key files — add the new service),
  `AGENT.md` (Known fragile surfaces — record the same-day-tx bucketing hazard so it can't
  recur silently), `TECH_DEBT.md` if any residual is found. No `DECISIONS.md` ADR (no
  non-obvious decision).

## Verification

The `## Verify` block in AGENT.md (`npm run verify`) runs automatically. Beyond it:

- **Manual data check (Coding agent):** run the app (or a throwaway `scratch/` probe
  mirroring the route) for the owner's portfolio over the **1M** range and confirm the
  2026-07-17 point equals the NVDA + ENGI.PA total (~€3,117), not ~€5,373, and that the
  series is a smooth flat-then-single-step curve with no isolated mountain. Confirm the
  2026-07-20 point (~€3,122) is essentially unchanged from before the fix (only 07-17
  moves).
- **Cross-range sanity:** spot-check 3M and 1Y (also date-keyed) still render and that 1D/1W
  (intraday) are unchanged — the fix must not alter the intraday path.

## Assumptions

- The correct semantic for a same-day BUY and SELL is that **both settle within that
  calendar day's bucket** (the portfolio held the sold position for part of the day but the
  end-of-day snapshot reflects the post-rotation holdings). This matches how a daily-close
  series should read and is what removes the spike; the alternative (sub-day ordering within
  a single daily bucket) is not representable in a one-point-per-day series anyway.
- Date-keyed buckets are keyed at UTC midnight (confirmed in the route's collapse logic);
  end-of-UTC-day is therefore the correct comparison instant for that path. If the bucketing
  key ever changes to local time, this boundary must move with it.
- No Designer stage is required: this is a pure data/computation fix. The chart rendering
  (axis, gridlines, hover) is already correct and unchanged — the only visible effect is the
  spurious spike disappearing. Flag to the orchestrator that Designer can be skipped.

## Open decisions

None. The root cause is a concrete computational bug with an obvious correct fix; no owner
sign-off is required before coding.
