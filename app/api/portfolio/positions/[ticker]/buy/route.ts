import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

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
    const { quantity, price, date, fees = 0, notes = "" } = body;

    // Validate input
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (!price || price <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

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

    // Wrap all writes in a transaction so they either ALL succeed or ALL fail.
    // Inside this callback, we use `tx` instead of `prisma` — this ensures
    // every operation is part of the same database transaction.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create buy transaction record
      const totalAmount = new Decimal(quantity).mul(price).plus(fees);

      const transaction = await tx.transaction.create({
        data: {
          portfolioId: portfolio.id,
          positionId: position.id,
          type: "BUY",
          ticker,
          name: position.name,
          quantity: new Decimal(quantity),
          price: new Decimal(price),
          totalAmount,
          fees: new Decimal(fees),
          executedAt: new Date(date || Date.now()),
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
      const positions = await tx.position.findMany({
        where: { portfolioId: portfolio.id },
      });

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

      // 4. Update portfolio with new totals
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: {
          totalValue,
          totalCost,
          unrealizedPL: totalUnrealizedPL,
        },
      });

      return { transaction, newAvgCostBasis, newTotalQuantity };
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
      newAvgCostBasis: result.newAvgCostBasis.toNumber(),
      newTotalQuantity: result.newTotalQuantity.toNumber(),
    });
  } catch (error) {
    console.error("Buy more error:", error);
    return NextResponse.json(
      { error: "Failed to add to position" },
      { status: 500 }
    );
  }
}
