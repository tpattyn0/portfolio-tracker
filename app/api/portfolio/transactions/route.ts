import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");
    const ticker = searchParams.get("ticker");

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
      include: {
        position: {
          select: { currency: true }
        }
      }
    });

    // Get base currency for conversion
    const baseCurrency = portfolio.baseCurrency || 'EUR';

    // Convert Decimal to number and apply currency conversion
    const serializedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        const transactionCurrency = tx.position?.currency || 'USD';
        let conversionRate = 1;

        // Get conversion rate if currencies differ
        if (transactionCurrency !== baseCurrency) {
          try {
            conversionRate = await exchangeRateService.getRate(transactionCurrency, baseCurrency);
          } catch (error) {
            console.error(`Failed to get rate ${transactionCurrency} -> ${baseCurrency}:`, error);
          }
        }

        return {
          id: tx.id,
          portfolioId: tx.portfolioId,
          positionId: tx.positionId,
          ticker: tx.ticker,
          type: tx.type,
          quantity: tx.quantity.toNumber(),
          price: tx.price.toNumber() * conversionRate,
          totalAmount: tx.totalAmount.toNumber() * conversionRate,
          fees: tx.fees.toNumber() * conversionRate,
          executedAt: tx.executedAt,
          createdAt: tx.createdAt,
          originalCurrency: transactionCurrency,
          conversionRate,
        };
      })
    );

    return NextResponse.json(serializedTransactions);
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}