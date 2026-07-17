import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  matchFifoLots,
  calculateRealizedPL,
  resolveCostBasisWithFallback,
  type Lot,
} from "@/lib/services/realized-pl.service";

interface ClosedPosition {
  id: string;
  positionId: string;
  transactionId: string;
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  firstBuyDate: Date;
  closeDate: Date;
  holdingDays: number;
  totalSharesSold: number;
  avgCostBasis: number;
  avgSellPrice: number;
  realizedPL: number;
  realizedPLPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  isPartial: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sortBy") || "closeDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const outcome = (searchParams.get("outcome") as "winners" | "losers" | "all" | null) || "all";
    const tickersParam = searchParams.get("tickers");
    const tickers = tickersParam ? tickersParam.split(",") : [];

    // Define closedPositionsWithMetrics at the function scope
    let closedPositionsWithMetrics: ClosedPosition[] = [];

    // Get all positions with sell transactions (both fully and partially closed)
    const positions = await prisma.position.findMany({
      where: {
        portfolioId: portfolio.id,
        transactions: {
          some: {
            type: "SELL"
          }
        },
        ...(tickers.length > 0 && {
          OR: [
            { ticker: { in: tickers } },
            { name: { in: tickers } }
          ]
        })
      },
      include: {
        transactions: {
          orderBy: { executedAt: "asc" },
        },
      },
    });

    // Process each position to create closed position entries for each sell transaction
    closedPositionsWithMetrics = [];
    
    // Track unique tickers and names for the filter
    const tickerSet = new Map<string, { name: string, ticker: string }>();
    
    for (const position of positions) {
      const buyTransactions = position.transactions.filter(t => t.type === "BUY");
      const sellTransactions = position.transactions.filter(t => t.type === "SELL");
      
      // Track remaining buy lots (FIFO method) — fees included per lot so
      // realized P/L matches the sell route's accounting (AUD-03).
      const buyLots: Lot[] = buyTransactions.map(t => ({
        quantity: new Decimal(t.quantity.toString()),
        price: new Decimal(t.price.toString()),
        fees: new Decimal(t.fees.toString()),
        date: t.executedAt
      }));

      // Process each sell transaction as a separate closed position
      for (const sell of sellTransactions) {
        const sellQuantity = new Decimal(sell.quantity.toString());
        const matchResult = matchFifoLots(buyLots, sellQuantity);
        const { firstBuyDate } = matchResult;

        // AUD-04: previously this `continue`d whenever unmatched > 0, which made
        // `isPartial` dead code (always false by the time it was read below) and
        // silently dropped the sell from the list. Now: match what we can against
        // available lots, fall back to the position's average cost basis for any
        // unmatched remainder (data inconsistency), and always include the entry.
        const { totalCostBasis, unmatchedQuantity } = resolveCostBasisWithFallback(
          matchResult,
          position.avgCostBasis,
          `Position ${position.id}: couldn't match ${sellQuantity.toString()} sold shares`
        );

        // Calculate metrics for this closed position
        const sellPrice = new Decimal(sell.price.toString());
        const sellFees = new Decimal(sell.fees.toString());
        const { realizedPL, realizedPLPercent } = calculateRealizedPL(
          sellQuantity,
          sellPrice,
          sellFees,
          totalCostBasis
        );

        // Calculate holding period in days
        const buyDate = firstBuyDate || position.firstBuyDate;
        const closeDate = sell.executedAt;
        const holdingDays = Math.ceil(
          (closeDate.getTime() - (buyDate || new Date()).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        const closedPositionId = `${position.id}-${sell.id}`;

        closedPositionsWithMetrics.push({
          id: closedPositionId,
          positionId: position.id,
          transactionId: sell.id,
          ticker: position.ticker,
          name: position.name,
          exchange: position.exchange,
          currency: position.currency,
          firstBuyDate: firstBuyDate || new Date(),
          closeDate: sell.executedAt,
          holdingDays,
          totalSharesSold: Number(sell.quantity),
          avgCostBasis: sellQuantity.gt(0)
            ? Number(totalCostBasis.dividedBy(sellQuantity))
            : 0,
          avgSellPrice: Number(sellPrice),
          realizedPL: Number(realizedPL),
          realizedPLPercent: Number(realizedPLPercent),
          totalReturn: Number(realizedPL),
          totalReturnPercent: Number(realizedPLPercent),
          isPartial: unmatchedQuantity.gt(0),
        });

        if (position.ticker) {
          tickerSet.set(position.ticker, {
            name: position.name,
            ticker: position.ticker
          });
        }
      }
    }

    const tickerOptions = Array.from(tickerSet.values()).map(({ ticker, name }) => ({
      value: ticker,
      label: name,
      display: `${ticker} - ${name}`
    }));

    let filteredPositions = closedPositionsWithMetrics;
    if (outcome === "winners") {
      filteredPositions = filteredPositions.filter((p) => p.realizedPL > 0);
    } else if (outcome === "losers") {
      filteredPositions = filteredPositions.filter((p) => p.realizedPL < 0);
    }

    filteredPositions.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "realizedPL":
          comparison = a.realizedPL - b.realizedPL;
          break;
        case "realizedPLPercent":
          comparison = a.realizedPLPercent - b.realizedPLPercent;
          break;
        case "holdingDays":
          comparison = a.holdingDays - b.holdingDays;
          break;
        case "closeDate":
        default:
          comparison = a.closeDate.getTime() - b.closeDate.getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    const totalClosedPositions = filteredPositions.length;
    const totalRealizedPL = filteredPositions.reduce(
      (sum, p) => sum + p.realizedPL,
      0
    );
    const avgHoldingDays =
      filteredPositions.reduce((sum, p) => sum + p.holdingDays, 0) /
      Math.max(1, filteredPositions.length);

    const winningTrades = filteredPositions.filter((p) => p.realizedPL > 0);
    const winRate = winningTrades.length / Math.max(1, filteredPositions.length);

    const returns = filteredPositions.map((p) => p.totalReturnPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / Math.max(1, returns.length);

    let medianReturn = 0;
    if (returns.length > 0) {
      const sorted = [...returns].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianReturn = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return NextResponse.json({
      positions: filteredPositions,
      aggregates: {
        totalClosedPositions,
        totalRealizedPL,
        avgHoldingDays,
        winRate,
        avgReturn,
        medianReturn,
      },
      tickerOptions,
    });
  } catch (error) {
    console.error("Error in closed positions API:", error);
    return NextResponse.json(
      { error: "Failed to process closed positions" },
      { status: 500 }
    );
  }
}