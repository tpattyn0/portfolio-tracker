import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { matchFifoLots, calculateRealizedPL, type Lot } from "@/lib/services/realized-pl.service";

// AUD-08: validate the body instead of trusting raw JSON.
const sellSchema = z.object({
  quantity: z.number().positive(),
  price: z.number().positive(),
  date: z.string().optional(),
  fees: z.number().min(0).default(0),
  notes: z.string().optional().default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;
    const { ticker } = await params;

    const body = await request.json();
    const { quantity, price, date, fees, notes } = sellSchema.parse(body);

    // Get the position
    const position = await prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker,
        },
      },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Check if user has enough shares
    if (position.quantity.lessThan(quantity)) {
      return NextResponse.json(
        { error: `Insufficient shares. You have ${position.quantity} shares.` },
        { status: 400 }
      );
    }

    // AUD-03: realized P/L is now computed via the same FIFO-including-fees
    // method used by /api/portfolio/closed-positions, so the two surfaces no
    // longer disagree. Match this sell against the position's BUY lots in
    // chronological order.
    const buyTransactions = await prisma.transaction.findMany({
      where: { positionId: position.id, type: "BUY" },
      orderBy: { executedAt: "asc" },
    });

    const lots: Lot[] = buyTransactions.map((t) => ({
      quantity: new Decimal(t.quantity.toString()),
      price: new Decimal(t.price.toString()),
      fees: new Decimal(t.fees.toString()),
      date: t.executedAt,
    }));

    const { totalBuyCost, unmatchedQuantity } = matchFifoLots(lots, new Decimal(quantity));
    if (unmatchedQuantity.gt(0)) {
      console.warn(
        `Sell of ${quantity} ${ticker} exceeds matchable FIFO buy lots by ${unmatchedQuantity.toString()} — falling back to average cost basis for the unmatched portion.`
      );
    }
    // Cover any unmatched remainder (data inconsistency) with avg cost basis so the
    // route never silently drops value from the calculation.
    const fallbackCost = unmatchedQuantity.gt(0)
      ? unmatchedQuantity.mul(position.avgCostBasis)
      : new Decimal(0);
    const totalCostBasis = totalBuyCost.plus(fallbackCost);

    const { realizedPL } = calculateRealizedPL(
      new Decimal(quantity),
      new Decimal(price),
      new Decimal(fees),
      totalCostBasis
    );

    // Wrap all writes in a transaction so they either ALL succeed or ALL fail.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create sell transaction record
      const transaction = await tx.transaction.create({
        data: {
          portfolioId: portfolio.id,
          positionId: position.id,
          type: "SELL",
          ticker,
          name: position.name,
          quantity: new Decimal(quantity),
          price: new Decimal(price),
          totalAmount: new Decimal(quantity).mul(price),
          fees: new Decimal(fees),
          executedAt: new Date(date || Date.now()),
          notes,
        },
      });

      // 2. Update position quantities and P/L
      const remainingQuantity = position.quantity.minus(quantity);

      const newMarketValue = remainingQuantity.mul(position.currentPrice);
      const newUnrealizedPL = remainingQuantity.equals(0)
        ? new Decimal(0)
        : newMarketValue.minus(remainingQuantity.mul(position.avgCostBasis));
      const newUnrealizedPLPercent =
        remainingQuantity.equals(0) ||
        remainingQuantity.mul(position.avgCostBasis).equals(0)
          ? new Decimal(0)
          : newUnrealizedPL
              .div(remainingQuantity.mul(position.avgCostBasis))
              .mul(100);

      await tx.position.update({
        where: { id: position.id },
        data: {
          quantity: remainingQuantity,
          marketValue: newMarketValue,
          unrealizedPL: newUnrealizedPL,
          unrealizedPLPercent: newUnrealizedPLPercent,
          lastActivity: new Date(),
        },
      });

      // 3. Recalculate portfolio totals from active positions only
      const activePositions = await tx.position.findMany({
        where: {
          portfolioId: portfolio.id,
          quantity: { gt: 0 },
        },
      });

      const totalValue = activePositions.reduce(
        (sum, p) => sum.plus(p.marketValue),
        new Decimal(0)
      );

      const totalCost = activePositions.reduce(
        (sum, p) => sum.plus(p.quantity.mul(p.avgCostBasis)),
        new Decimal(0)
      );

      const totalUnrealizedPL = activePositions.reduce(
        (sum, p) => sum.plus(p.unrealizedPL),
        new Decimal(0)
      );

      const newRealizedPL = portfolio.realizedPL.plus(realizedPL);

      // 4. Update portfolio with new totals
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: {
          totalValue,
          totalCost,
          unrealizedPL: totalUnrealizedPL,
          realizedPL: newRealizedPL,
        },
      });

      return { transaction, remainingQuantity };
    });

    return NextResponse.json({
      success: true,
      transaction: {
        ...result.transaction,
        quantity: result.transaction.quantity.toNumber(),
        price: result.transaction.price.toNumber(),
        totalAmount: result.transaction.totalAmount.toNumber(),
        fees: result.transaction.fees.toNumber(),
      },
      realizedPL: realizedPL.toNumber(),
      remainingShares: result.remainingQuantity.toNumber(),
      positionClosed: result.remainingQuantity.equals(0),
    });
  } catch (error) {
    console.error("Sell position error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sell position" },
      { status: 500 }
    );
  }
}
