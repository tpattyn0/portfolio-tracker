import { Decimal } from "@prisma/client/runtime/library";

/**
 * Shared realized P/L accounting, used by both:
 *  - POST /api/portfolio/positions/[ticker]/sell (accumulates into portfolio.realizedPL)
 *  - GET /api/portfolio/closed-positions (per-trade FIFO history)
 *
 * Extracted per AUD-03 (2026-07-17 audit): the two surfaces previously computed
 * "realized P/L" two different ways — average-cost-basis (sell route, buy fees
 * only) vs FIFO lot matching (closed-positions, no fees at all) — so the numbers
 * silently disagreed for the same transaction history. FIFO including both buy
 * and sell fees is now the single method, used everywhere realized P/L is shown.
 */

export interface Lot {
  quantity: Decimal;
  price: Decimal;
  fees: Decimal;
  date: Date;
}

export interface FifoMatchResult {
  /** Total cost basis (lot price + prorated buy fees) for the matched quantity. */
  totalBuyCost: Decimal;
  /** Earliest date among the lots consumed to fill this sell. */
  firstBuyDate: Date | null;
  /** Quantity that could not be matched against available lots (data inconsistency). */
  unmatchedQuantity: Decimal;
}

/**
 * Consumes FIFO lots (oldest first) to cover `sellQuantity`, mutating each
 * lot's `quantity` in place (so repeated calls against the same `lots` array
 * correctly consume across multiple sells in chronological order).
 */
export function matchFifoLots(lots: Lot[], sellQuantity: Decimal): FifoMatchResult {
  let remaining = sellQuantity;
  let totalBuyCost = new Decimal(0);
  let firstBuyDate: Date | null = null;

  for (const lot of lots) {
    if (remaining.lte(0)) break;
    if (lot.quantity.lte(0)) continue;

    const quantityFromLot = Decimal.min(remaining, lot.quantity);
    // Prorate this lot's fees across the portion consumed.
    const feePerShare = lot.quantity.gt(0) ? lot.fees.div(lot.quantity) : new Decimal(0);
    const costForThisLot = quantityFromLot
      .times(lot.price)
      .plus(quantityFromLot.times(feePerShare));

    totalBuyCost = totalBuyCost.plus(costForThisLot);
    lot.quantity = lot.quantity.minus(quantityFromLot);
    remaining = remaining.minus(quantityFromLot);

    if (!firstBuyDate || lot.date < firstBuyDate) {
      firstBuyDate = lot.date;
    }
  }

  return { totalBuyCost, firstBuyDate, unmatchedQuantity: remaining };
}

export interface CostBasisResult {
  /** Total cost basis for the full sell quantity: matched FIFO cost plus any
   * unmatched-remainder fallback at average cost basis. */
  totalCostBasis: Decimal;
  /** Quantity that could not be matched against available lots (data inconsistency). */
  unmatchedQuantity: Decimal;
}

/**
 * Covers a FIFO match's unmatched remainder (a sell that exceeds available buy
 * lots — a data inconsistency) with the position's average cost basis, so
 * callers never silently drop value from realized-P/L calculations. Shared by
 * the sell route and the closed-positions route (AUD-FIX-03) so both surfaces
 * apply the exact same fallback instead of duplicating the arithmetic.
 */
export function resolveCostBasisWithFallback(
  matchResult: FifoMatchResult,
  avgCostBasis: Decimal,
  context: string
): CostBasisResult {
  const { totalBuyCost, unmatchedQuantity } = matchResult;
  if (unmatchedQuantity.gt(0)) {
    console.warn(
      `${context}: ${unmatchedQuantity.toString()} shares couldn't be matched against FIFO buy lots — using average cost basis for the unmatched portion.`
    );
  }
  const fallbackCost = unmatchedQuantity.gt(0)
    ? unmatchedQuantity.mul(avgCostBasis)
    : new Decimal(0);
  return { totalCostBasis: totalBuyCost.plus(fallbackCost), unmatchedQuantity };
}

export interface RealizedPLResult {
  realizedPL: Decimal;
  realizedPLPercent: Decimal;
}

/** Realized P/L for a matched sell: sale proceeds minus FIFO cost basis minus sell fees. */
export function calculateRealizedPL(
  sellQuantity: Decimal,
  sellPrice: Decimal,
  sellFees: Decimal,
  totalBuyCost: Decimal
): RealizedPLResult {
  const sellValue = sellQuantity.times(sellPrice).minus(sellFees);
  const realizedPL = sellValue.minus(totalBuyCost);
  const realizedPLPercent = totalBuyCost.equals(0)
    ? new Decimal(0)
    : realizedPL.dividedBy(totalBuyCost).times(100);
  return { realizedPL, realizedPLPercent };
}

export interface TransactionForRealizedPL {
  type: string;
  quantity: Decimal;
  price: Decimal;
  fees: Decimal;
  executedAt: Date;
}

/**
 * Total realized P/L for a single position, summed across every SELL
 * transaction on file, FIFO-matched against that position's own BUY
 * transactions and depleted cumulatively in chronological order — the same
 * algorithm `GET /api/portfolio/closed-positions` uses per position, applied
 * here to one position's transaction list (`GET
 * /api/portfolio/positions/[ticker]` — plans/2026-07-19-positions-tab.md,
 * PT-I1). `Position` has no persisted per-position `realizedPL` column (only
 * `Portfolio.realizedPL`, a portfolio-wide accumulator, exists — see
 * `sell/route.ts`), so this is computed on read rather than stored,
 * mirroring how closed-positions already avoids persisting a `ClosedPosition`
 * row. `avgCostBasis` is the position's current average cost basis, used only
 * as the unmatched-remainder fallback (see `resolveCostBasisWithFallback`).
 */
export function computePositionRealizedPL(
  transactions: TransactionForRealizedPL[],
  avgCostBasis: Decimal
): Decimal {
  const buyLots: Lot[] = transactions
    .filter((t) => t.type === "BUY")
    .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())
    .map((t) => ({
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      date: t.executedAt,
    }));

  const sellTransactions = transactions
    .filter((t) => t.type === "SELL")
    .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

  let totalRealizedPL = new Decimal(0);
  for (const sell of sellTransactions) {
    const matchResult = matchFifoLots(buyLots, sell.quantity);
    const { totalCostBasis } = resolveCostBasisWithFallback(
      matchResult,
      avgCostBasis,
      `computePositionRealizedPL: sell of ${sell.quantity.toString()} on ${sell.executedAt.toISOString()}`
    );
    const { realizedPL } = calculateRealizedPL(sell.quantity, sell.price, sell.fees, totalCostBasis);
    totalRealizedPL = totalRealizedPL.plus(realizedPL);
  }

  return totalRealizedPL;
}
