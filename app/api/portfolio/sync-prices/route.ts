import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { marketDataService } from "@/lib/services/market-data.service";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's portfolio with positions
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.user.id },
      include: { positions: true },
    });

    if (!portfolio || portfolio.positions.length === 0) {
      return NextResponse.json({ message: "No positions to update" });
    }

    // Fetch live prices for all positions
    const pricePromises = portfolio.positions.map(async (position) => {
      try {
        const quote = await marketDataService.getQuote(position.ticker);
        return { ticker: position.ticker, price: quote.price };
      } catch (error) {
        console.error(`Failed to fetch price for ${position.ticker}:`, error);
        return { ticker: position.ticker, price: position.currentPrice.toNumber() };
      }
    });

    const prices = await Promise.all(pricePromises);
    const priceMap = new Map(prices.map(p => [p.ticker, p.price]));

    // Update positions with new prices
    const updatePromises = portfolio.positions.map(async (position) => {
      const newPrice = priceMap.get(position.ticker) || position.currentPrice.toNumber();
      const quantity = position.quantity.toNumber();
      const avgCost = position.avgCostBasis.toNumber();
      
      const marketValue = quantity * newPrice;
      const totalCost = quantity * avgCost;
      const unrealizedPL = marketValue - totalCost;
      const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;

      return prisma.position.update({
        where: { id: position.id },
        data: {
          currentPrice: new Decimal(newPrice),
          marketValue: new Decimal(marketValue),
          unrealizedPL: new Decimal(unrealizedPL),
          unrealizedPLPercent: new Decimal(unrealizedPLPercent),
        },
      });
    });

    await Promise.all(updatePromises);

    // Update portfolio totals
    const updatedPositions = await prisma.position.findMany({
      where: { portfolioId: portfolio.id },
    });

    const totalValue = updatedPositions.reduce(
      (sum, pos) => sum + pos.marketValue.toNumber(),
      0
    );
    const totalCost = updatedPositions.reduce(
      (sum, pos) => sum + pos.quantity.toNumber() * pos.avgCostBasis.toNumber(),
      0
    );
    const unrealizedPL = totalValue - totalCost;

    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        totalValue: new Decimal(totalValue),
        totalCost: new Decimal(totalCost),
        unrealizedPL: new Decimal(unrealizedPL),
      },
    });

    return NextResponse.json({ 
      message: "Prices updated successfully",
      updated: prices.length 
    });
  } catch (error) {
    console.error("Price sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync prices" },
      { status: 500 }
    );
  }
}