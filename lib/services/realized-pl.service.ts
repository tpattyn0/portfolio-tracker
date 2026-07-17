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
