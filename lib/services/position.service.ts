import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, Position, Transaction } from "@prisma/client";

/**
 * Shared position-mutation logic used by both:
 *  - POST /api/portfolio/positions (existing-position branch)
 *  - POST /api/portfolio/positions/[ticker]/buy
 *
 * Extracted per AUD-02 (2026-07-17 audit): the two routes previously had
 * independent, diverging implementations of "buy more of an existing
 * position" — one used raw floats and never recalculated portfolio totals.
 * This is now the single source of truth for that operation. Callers run it
 * inside their own `prisma.$transaction` and pass the transactional client.
 */

export interface ApplyBuyParams {
  tx: Prisma.TransactionClient;
  portfolioId: string;
  position: Position;
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  fees: number;
  date: Date;
  notes?: string;
}

export interface ApplyBuyResult {
  transaction: Transaction;
  newAvgCostBasis: Decimal;
  newTotalQuantity: Decimal;
}

/**
 * Records a BUY transaction against an existing position, recomputes the
 * position's average cost basis / market value / unrealized P&L against its
 * current price, and recalculates portfolio-level totals from all positions.
 * Must be called within a `prisma.$transaction` callback.
 */
export async function applyBuyToPosition({
  tx,
  portfolioId,
  position,
  ticker,
  name,
  quantity,
  price,
  fees,
  date,
  notes = "",
}: ApplyBuyParams): Promise<ApplyBuyResult> {
  // 1. Create buy transaction record
  const totalAmount = new Decimal(quantity).mul(price).plus(fees);

  const transaction = await tx.transaction.create({
    data: {
      portfolioId,
      positionId: position.id,
      type: "BUY",
      ticker,
      name,
      quantity: new Decimal(quantity),
      price: new Decimal(price),
      totalAmount,
      fees: new Decimal(fees),
      executedAt: date,
      notes,
    },
  });

  // 2. Calculate and update position with new average cost basis
  const newTotalQuantity = position.quantity.plus(quantity);
  const oldTotalCost = position.quantity.mul(position.avgCostBasis);
  const newPurchaseCost = new Decimal(quantity).mul(price).plus(fees);
  const newTotalCost = oldTotalCost.plus(newPurchaseCost);
  const newAvgCostBasis = newTotalCost.div(newTotalQuantity);

  const newMarketValue = newTotalQuantity.mul(position.currentPrice);
  const newUnrealizedPL = newMarketValue.minus(newTotalCost);
  const newUnrealizedPLPercent = newTotalCost.equals(0)
    ? new Decimal(0)
    : newUnrealizedPL.div(newTotalCost).mul(100);

  await tx.position.update({
    where: { id: position.id },
    data: {
      quantity: newTotalQuantity,
      avgCostBasis: newAvgCostBasis,
      marketValue: newMarketValue,
      unrealizedPL: newUnrealizedPL,
      unrealizedPLPercent: newUnrealizedPLPercent,
      lastActivity: new Date(),
    },
  });

  // 3. Recalculate portfolio totals from all positions
  await recalculatePortfolioTotals(tx, portfolioId);

  return { transaction, newAvgCostBasis, newTotalQuantity };
}

/** Recomputes and persists `totalValue`/`totalCost`/`unrealizedPL` on the portfolio from its current positions. */
export async function recalculatePortfolioTotals(
  tx: Prisma.TransactionClient,
  portfolioId: string
): Promise<void> {
  const positions = await tx.position.findMany({ where: { portfolioId } });

  const totalValue = positions.reduce(
    (sum, p) => sum.plus(p.marketValue),
    new Decimal(0)
  );
  const totalCost = positions.reduce(
    (sum, p) => sum.plus(p.quantity.mul(p.avgCostBasis)),
    new Decimal(0)
  );
  const totalUnrealizedPL = positions.reduce(
    (sum, p) => sum.plus(p.unrealizedPL),
    new Decimal(0)
  );

  await tx.portfolio.update({
    where: { id: portfolioId },
    data: { totalValue, totalCost, unrealizedPL: totalUnrealizedPL },
  });
}
