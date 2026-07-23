import { NextRequest, NextResponse } from "next/server";
import { marketDataService } from "@/lib/services/market-data.service";
import { getAuthenticatedUser } from "@/lib/utils/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { symbol } = await params;
    const quote = await marketDataService.getQuote(symbol);
    return NextResponse.json(quote);
  } catch (error) {
    console.error("Quote fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}