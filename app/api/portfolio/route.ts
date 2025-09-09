import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.user.id },
      include: {
        positions: {
          orderBy: { marketValue: "desc" },
        },
        transactions: {
          orderBy: { executedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!portfolio) {
      // Create portfolio if it doesn't exist
      const newPortfolio = await prisma.portfolio.create({
        data: {
          userId: session.user.id,
        },
        include: {
          positions: true,
          transactions: true,
        },
      });
      
      return NextResponse.json({
        ...newPortfolio,
        totalValue: 0,
        totalCost: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        positions: [],
      });
    }

    // Calculate additional metrics
    const positions = portfolio.positions.map(pos => ({
      ...pos,
      quantity: pos.quantity.toNumber(),
      avgCostBasis: pos.avgCostBasis.toNumber(),
      currentPrice: pos.currentPrice.toNumber(),
      marketValue: pos.marketValue.toNumber(),
      unrealizedPL: pos.unrealizedPL.toNumber(),
      unrealizedPLPercent: pos.unrealizedPLPercent.toNumber(),
    }));

    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.marketValue,
      0
    );

    const totalCost = positions.reduce(
      (sum, pos) => sum + (pos.quantity * pos.avgCostBasis),
      0
    );

    const totalReturn = totalValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Mock daily change (in real app, compare with yesterday's close)
    const dayChange = totalValue * 0.0127; // Mock 1.27% change
    const dayChangePercent = 1.27;

    return NextResponse.json({
      ...portfolio,
      totalValue,
      totalCost,
      totalReturn,
      totalReturnPercent,
      dayChange,
      dayChangePercent,
      positions,
      transactions: portfolio.transactions.map(tx => ({
        ...tx,
        quantity: tx.quantity.toNumber(),
        price: tx.price.toNumber(),
        totalAmount: tx.totalAmount.toNumber(),
        fees: tx.fees.toNumber(),
      })),
    });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}