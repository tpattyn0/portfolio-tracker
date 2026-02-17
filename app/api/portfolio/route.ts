import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { marketDataService } from "@/lib/services/market-data.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    // Get base currency from query param or portfolio default
    const { searchParams } = new URL(request.url);
    const requestedBaseCurrency = searchParams.get('baseCurrency');

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: auth.userId },
      include: {
        positions: {
          where: {
            quantity: {
              gt: 0  // Only get positions with quantity > 0
            }
          },
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
          userId: auth.userId,
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

    // Get base currency for conversion (use requested currency or portfolio default)
    const baseCurrency = requestedBaseCurrency || portfolio.baseCurrency || 'EUR';

    // Build currency maps for all positions
    const symbolCurrency = new Map<string, string>();
    const exchangeRates = new Map<string, number>();

    for (const pos of portfolio.positions) {
      symbolCurrency.set(pos.ticker, pos.currency);

      if (pos.currency !== baseCurrency && !exchangeRates.has(pos.currency)) {
        try {
          const rate = await exchangeRateService.getRate(pos.currency, baseCurrency);
          exchangeRates.set(pos.currency, rate);
        } catch (error) {
          console.error(`Failed to get rate ${pos.currency} -> ${baseCurrency}:`, error);
          exchangeRates.set(pos.currency, 1);
        }
      } else {
        exchangeRates.set(pos.currency, 1);
      }
    }

    // Convert positions to base currency
    const positionsPromises = portfolio.positions.map(async (pos) => {
      const positionCurrency = pos.currency;
      const conversionRate = exchangeRates.get(positionCurrency) || 1;

      const avgCostBasis = pos.avgCostBasis.toNumber();
      const currentPrice = pos.currentPrice.toNumber();
      const quantity = pos.quantity.toNumber();
      const unrealizedPL = pos.unrealizedPL.toNumber();

      return {
        id: pos.id,
        portfolioId: pos.portfolioId,
        ticker: pos.ticker,
        name: pos.name,
        exchange: pos.exchange,
        quantity,
        // Keep all values in original currency for the positions table
        avgCostBasis: avgCostBasis, // NOT converted - stays in original currency
        currentPrice: currentPrice, // NOT converted - stays in original currency
        marketValue: pos.marketValue.toNumber(), // NOT converted - stays in original currency
        unrealizedPL: unrealizedPL, // NOT converted - stays in original currency
        unrealizedPLPercent: pos.unrealizedPLPercent.toNumber(),
        currency: positionCurrency, // The original currency of the stock
        originalCurrency: positionCurrency, // Explicit field for clarity
        conversionRate, // Keep for reference
        // Store converted value separately for portfolio totals calculation
        marketValueInBaseCurrency: pos.marketValue.toNumber() * conversionRate,
        firstBuyDate: pos.firstBuyDate,
        lastActivity: pos.lastActivity,
        createdAt: pos.createdAt,
        updatedAt: pos.updatedAt,
      };
    });

    const positions = await Promise.all(positionsPromises);

    // Use converted values for portfolio totals (in base currency)
    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.marketValueInBaseCurrency,
      0
    );

    const totalCost = positions.reduce(
      (sum, pos) => {
        // Convert cost to base currency
        const costInOriginalCurrency = pos.quantity * pos.avgCostBasis;
        return sum + (costInOriginalCurrency * pos.conversionRate);
      },
      0
    );

    const totalReturn = totalValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Calculate today's change by comparing current prices with yesterday's close
    let dayChange = 0;
    let dayChangePercent = 0;

    try {
      // For each position, calculate the change from yesterday
      const yesterdayValue = await Promise.all(
        positions.map(async (pos) => {
          try {
            // Get yesterday's closing price (use 1D historical data)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const historicalData = await marketDataService.getHistoricalRange(
              pos.ticker,
              yesterday,
              yesterday,
              '1d'
            );

            if (historicalData && historicalData.length > 0) {
              const yesterdayClose = historicalData[historicalData.length - 1].value;
              const quantity = pos.quantity;

              // Apply exchange rate if needed
              const positionCurrency = symbolCurrency.get(pos.ticker) || baseCurrency;
              const rate = exchangeRates.get(positionCurrency) || 1;

              return quantity * yesterdayClose * rate;
            }

            // If no historical data, use current value (no change)
            return pos.marketValueInBaseCurrency;
          } catch (error) {
            console.error(`Failed to get yesterday's price for ${pos.ticker}:`, error);
            return pos.marketValueInBaseCurrency;
          }
        })
      );

      const totalYesterdayValue = yesterdayValue.reduce((sum, val) => sum + val, 0);

      if (totalYesterdayValue > 0) {
        dayChange = totalValue - totalYesterdayValue;
        dayChangePercent = (dayChange / totalYesterdayValue) * 100;
      }
    } catch (error) {
      console.error('Failed to calculate day change:', error);
    }

    // Collect unique exchange rates used
    const exchangeRatesUsed = Array.from(
      new Set(positions.map(p => p.currency).filter(c => c !== baseCurrency))
    ).map(currency => ({
      from: currency,
      to: baseCurrency,
      rate: positions.find(p => p.currency === currency)?.conversionRate || 1,
    }));

    return NextResponse.json({
      ...portfolio,
      baseCurrency,
      totalValue,
      totalCost,
      totalReturn,
      totalReturnPercent,
      dayChange,
      dayChangePercent,
      positions,
      exchangeRatesUsed,
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