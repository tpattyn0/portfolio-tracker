import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");
    const ticker = searchParams.get("ticker");

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.user.id },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    const whereClause: any = {
      portfolioId: portfolio.id,
    };

    if (positionId) {
      whereClause.positionId = positionId;
    }

    if (ticker) {
      whereClause.ticker = ticker;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { executedAt: "desc" },
      take: 50, // Limit to last 50 transactions
    });

    // Convert Decimal to number for JSON serialization
    const serializedTransactions = transactions.map(tx => ({
      ...tx,
      quantity: tx.quantity.toNumber(),
      price: tx.price.toNumber(),
      totalAmount: tx.totalAmount.toNumber(),
      fees: tx.fees.toNumber(),
    }));

    return NextResponse.json(serializedTransactions);
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}