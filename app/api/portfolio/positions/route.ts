import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { marketDataService } from "@/lib/services/market-data.service";

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

    const totalCost = data.quantity * data.price + data.fees;
    const avgCostWithFees = data.price + (data.fees / data.quantity);

    if (existingPosition) {
      // Update existing position
      const oldQuantity = existingPosition.quantity.toNumber();
      const oldCostBasis = existingPosition.avgCostBasis.toNumber();
      const newTotalQuantity = oldQuantity + data.quantity;
      const oldTotalCost = oldQuantity * oldCostBasis;
      const newAvgCost = (oldTotalCost + totalCost) / newTotalQuantity;

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          portfolioId: portfolio.id,
          positionId: existingPosition.id,
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

      // Update position
      const updatedPosition = await prisma.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: new Decimal(newTotalQuantity),
          avgCostBasis: new Decimal(newAvgCost),
          marketValue: new Decimal(newTotalQuantity * data.price), // Using purchase price for now
          unrealizedPL: new Decimal(0), // Will be calculated with market data
          unrealizedPLPercent: new Decimal(0),
          lastActivity: new Date(),
        },
      });

      return NextResponse.json({ 
        position: updatedPosition,
        transaction: transaction,
        message: "Position updated successfully" 
      });
    } else {
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

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add position" },
      { status: 500 }
    );
  }
}