import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { applyBuyToPosition } from "@/lib/services/position.service";

// AUD-08: validate the body instead of trusting raw JSON — negative fees
// inflated realized P/L, bad dates/numbers threw uncaught 500s.
const buySchema = z.object({
  quantity: z.number().positive(),
  price: z.number().positive(),
  date: z.string().optional(),
  fees: z.number().min(0).default(0),
  notes: z.string().optional().default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;
    const { portfolio } = auth;
    const { ticker } = await params;

    const body = await request.json();
    const { quantity, price, date, fees, notes } = buySchema.parse(body);

    // Get the position
    const position = await prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker,
        },
      },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Wrap all writes in a transaction so they either ALL succeed or ALL fail.
    const result = await prisma.$transaction(async (tx) => {
      return applyBuyToPosition({
        tx,
        portfolioId: portfolio.id,
        position,
        ticker,
        name: position.name,
        quantity,
        price,
        fees,
        date: new Date(date || Date.now()),
        notes,
      });
    });

    return NextResponse.json({
      success: true,
      transaction: {
        ...result.transaction,
        quantity: result.transaction.quantity.toNumber(),
        price: result.transaction.price.toNumber(),
        totalAmount: result.transaction.totalAmount.toNumber(),
        fees: result.transaction.fees.toNumber(),
      },
      newAvgCostBasis: result.newAvgCostBasis.toNumber(),
      newTotalQuantity: result.newTotalQuantity.toNumber(),
    });
  } catch (error) {
    console.error("Buy more error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add to position" },
      { status: 500 }
    );
  }
}
