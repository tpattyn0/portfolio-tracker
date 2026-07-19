/**
 * Pure helpers for the "Positions" tab (renamed from "Transactions" per
 * `plans/2026-07-19-positions-tab.md`) shared by `research/[symbol]/page.tsx`
 * and `portfolio/[ticker]/page.tsx`. No DOM, no React, no side effects —
 * extracted so the tab-visibility and panel-suppression rules are testable
 * without rendering either page.
 */

/**
 * "Has or had a position" signal (plan Assumption A1): the Positions tab is
 * shown only when the symbol has at least one transaction on file, regardless
 * of whether a live `Position` row still exists. A fully-sold-but-not-deleted
 * position keeps its transactions (see `sell/route.ts`), so this stays true
 * for closed positions; a deleted position removes both position and
 * transactions, so this correctly goes false and the tab disappears.
 */
export function shouldShowPositionsTab(transactions: unknown[] | null | undefined): boolean {
  return Array.isArray(transactions) && transactions.length > 0;
}

/**
 * The Positions tab's live stat-band state (plan Task 4 / Assumption A2).
 *
 * IMPORTANT: gating on "a position record exists" (`!!position`) is NOT the
 * same as "currently held" — a fully-sold position still returns a 200
 * position record with `quantity: 0`. Showing the stat band for a quantity-0
 * position would render a misleading zero-value Market value / Unrealised
 * P/L panel. This helper is the single source of truth for that distinction:
 * gate on `quantity > 0` specifically, never on record presence alone.
 *
 * - `"held"` — a position record exists and quantity > 0: render the live
 *   stat band (Shares held / Average cost / Market value / Unrealised P/L).
 * - `"closed"` — a position record exists but quantity === 0: suppress the
 *   stat band, render the muted "Position closed." caption instead. The
 *   transaction table is unaffected by this state either way.
 * - `"none"` — no position record at all (never held, or held-then-deleted).
 *   Callers should fall back to the existing "you do not hold" empty state.
 */
export function getPositionsPanelState(
  position: { quantity: number } | null | undefined
): "held" | "closed" | "none" {
  if (!position) return "none";
  return position.quantity > 0 ? "held" : "closed";
}

/**
 * Whether a Realized P/L figure should be surfaced at all (plan
 * `plans/2026-07-19-positions-tab.md`, PT-I1 — owner decision PT-Q1:
 * re-surface Realized P/L in the Positions tab, for both held and closed
 * positions). Preserves the old `/portfolio/[ticker]` header's
 * `hasRealizedPL` semantic — `undefined`/`null` (not yet loaded, or the API
 * genuinely omitted it) and exactly `0` (nothing realized yet) both hide the
 * figure, since "no realized P/L" and "€0.00 realized P/L" read the same to a
 * user and a bare zero cell every time a position hasn't sold anything would
 * be noise on the far more common held-position case. This does not change
 * how realizedPL is computed — see `lib/services/realized-pl.service.ts`
 * `computePositionRealizedPL`, the single source of the actual number.
 */
export function hasRealizedPL(realizedPL: number | null | undefined): boolean {
  return realizedPL !== undefined && realizedPL !== null && realizedPL !== 0;
}
