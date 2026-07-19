import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { computePositionRealizedPL } from "@/lib/services/realized-pl.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;
    const { ticker } = await params;

    const position = await prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker,
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

    // Get base currency and conversion rate
    const baseCurrency = portfolio.baseCurrency || 'EUR';
    const positionCurrency = position.currency;
    let conversionRate = 1;

    if (positionCurrency !== baseCurrency) {
      try {
        conversionRate = await exchangeRateService.getRate(positionCurrency, baseCurrency);
      } catch (error) {
        console.error(`Failed to get rate ${positionCurrency} -> ${baseCurrency}:`, error);
      }
    }

    // Realized P/L has no persisted per-position column (only
    // `Portfolio.realizedPL`, a portfolio-wide accumulator, exists) — compute
    // it on read from this position's own transaction history, the same FIFO
    // algorithm `GET /api/portfolio/closed-positions` uses per position
    // (plans/2026-07-19-positions-tab.md, PT-I1). Converted to base currency
    // like the other money fields on this response.
    const realizedPL = computePositionRealizedPL(
      position.transactions.map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees,
        executedAt: tx.executedAt,
      })),
      position.avgCostBasis
    ).toNumber() * conversionRate;

    // Convert Decimal to number and apply currency conversion
    const serializedPosition = {
      ...position,
      quantity: position.quantity.toNumber(),
      avgCostBasis: position.avgCostBasis.toNumber() * conversionRate,
      currentPrice: position.currentPrice.toNumber() * conversionRate,
      marketValue: position.marketValue.toNumber() * conversionRate,
      unrealizedPL: position.unrealizedPL.toNumber() * conversionRate,
      unrealizedPLPercent: position.unrealizedPLPercent.toNumber(),
      baseCurrency,
      originalCurrency: positionCurrency,
      conversionRate,
      realizedPL,
      transactions: position.transactions.map(tx => ({
        ...tx,
        quantity: tx.quantity.toNumber(),
        price: tx.price.toNumber() * conversionRate,
        totalAmount: tx.totalAmount.toNumber() * conversionRate,
        fees: tx.fees.toNumber() * conversionRate,
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
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;
    const { ticker } = await params;

    // Delete the position (transactions will be cascade deleted)
    await prisma.position.delete({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker,
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