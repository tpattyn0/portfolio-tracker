import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.user.id },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    const position = await prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker: params.ticker,
        },
      },
      include: {
        transactions: {
          orderBy: { executedAt: "desc" },
        },
      },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Convert Decimal to number for JSON serialization
    const serializedPosition = {
      ...position,
      quantity: position.quantity.toNumber(),
      avgCostBasis: position.avgCostBasis.toNumber(),
      currentPrice: position.currentPrice.toNumber(),
      marketValue: position.marketValue.toNumber(),
      unrealizedPL: position.unrealizedPL.toNumber(),
      unrealizedPLPercent: position.unrealizedPLPercent.toNumber(),
      transactions: position.transactions.map(tx => ({
        ...tx,
        quantity: tx.quantity.toNumber(),
        price: tx.price.toNumber(),
        totalAmount: tx.totalAmount.toNumber(),
        fees: tx.fees.toNumber(),
      })),
    };

    return NextResponse.json(serializedPosition);
  } catch (error) {
    console.error("Position fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch position" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.user.id },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    // Delete the position (transactions will be cascade deleted)
    await prisma.position.delete({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker: params.ticker,
        },
      },
    });

    return NextResponse.json({ message: "Position deleted successfully" });
  } catch (error) {
    console.error("Position delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete position" },
      { status: 500 }
    );
  }
}