import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { marketDataService } from "@/lib/services/market-data.service";
import { applyBuyToPosition } from "@/lib/services/position.service";

const addPositionSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  date: z.string(),
  fees: z.number().min(0).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;

    const body = await request.json();
    const data = addPositionSchema.parse(body);

    // Check if position already exists
    const existingPosition = await prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker: data.ticker,
        },
      },
    });

    if (existingPosition) {
      // Delegate to the same buy-more logic as positions/[ticker]/buy (AUD-02):
      // wrapped in a transaction, Decimal arithmetic throughout, market value
      // computed against the position's current price (not purchase price),
      // and portfolio totals recalculated.
      const result = await prisma.$transaction(async (tx) => {
        return applyBuyToPosition({
          tx,
          portfolioId: portfolio.id,
          position: existingPosition,
          ticker: data.ticker,
          name: data.name,
          quantity: data.quantity,
          price: data.price,
          fees: data.fees,
          date: new Date(data.date),
        });
      });

      return NextResponse.json({
        position: result.position,
        transaction: result.transaction,
        message: "Position updated successfully"
      });
    } else {
      const totalCost = data.quantity * data.price + data.fees;
      const avgCostWithFees = data.price + (data.fees / data.quantity);

      // Fetch stock info to get the correct currency
      let stockCurrency = "USD"; // Default to USD
      let exchange = "NASDAQ";
      try {
        const quote = await marketDataService.getQuote(data.ticker);
        if (quote?.currency) {
          stockCurrency = quote.currency;
        }
        if (quote?.exchange) {
          exchange = quote.exchange;
        }
      } catch (error) {
        console.error(`Failed to get quote for ${data.ticker}, using defaults:`, error);
      }

      // Create new position and transaction in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create position
        const position = await tx.position.create({
          data: {
            portfolioId: portfolio.id,
            ticker: data.ticker,
            name: data.name,
            exchange: exchange,
            currency: stockCurrency, // Use the currency from market data
            quantity: new Decimal(data.quantity),
            avgCostBasis: new Decimal(avgCostWithFees),
            currentPrice: new Decimal(data.price), // TODO: Get current price
            marketValue: new Decimal(data.quantity * data.price),
            unrealizedPL: new Decimal(0),
            unrealizedPLPercent: new Decimal(0),
            firstBuyDate: new Date(data.date),
            lastActivity: new Date(),
          },
        });

        // Create transaction
        const transaction = await tx.transaction.create({
          data: {
            portfolioId: portfolio.id,
            positionId: position.id,
            type: "BUY",
            ticker: data.ticker,
            name: data.name,
            quantity: new Decimal(data.quantity),
            price: new Decimal(data.price),
            totalAmount: new Decimal(totalCost),
            fees: new Decimal(data.fees),
            executedAt: new Date(data.date),
          },
        });

        return { position, transaction };
      });

      return NextResponse.json({ 
        ...result,
        message: "Position created successfully" 
      });
    }
  } catch (error) {
    console.error("Add position error:", error); // Better error logging
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    // AUD-06: don't echo raw error.message to the client — it can leak
    // Prisma/upstream internals (model/field names, hostnames). Detail stays
    // in console.error above; the client gets a generic message.
    return NextResponse.json(
      { error: "Failed to add position" },
      { status: 500 }
    );
  }
}