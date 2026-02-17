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

    // Check if user has enough shares
    if (position.quantity.lessThan(quantity)) {
      return NextResponse.json(
        { error: `Insufficient shares. You have ${position.quantity} shares.` },
        { status: 400 }
      );
    }

    // Calculate realized P/L before the transaction
    const totalSaleValue = new Decimal(quantity).mul(price);
    const costBasis = position.avgCostBasis.mul(quantity);
    const realizedPL = totalSaleValue.minus(costBasis).minus(fees);

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
          totalAmount: totalSaleValue,
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
    return NextResponse.json(
      { error: "Failed to sell position" },
      { status: 500 }
    );
  }
}
