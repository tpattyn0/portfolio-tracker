import { NextRequest, NextResponse } from "next/server";
import { IntrinsicValueService } from "@/lib/services/intrinsic-value.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    
    // Get current price from query params or fetch it
    const searchParams = request.nextUrl.searchParams;
    const currentPrice = parseFloat(searchParams.get("price") || "0");
    
    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json(
        { error: "Current price is required" },
        { status: 400 }
      );
    }

    const intrinsicValue = await IntrinsicValueService.calculateIntrinsicValue(
      symbol,
      currentPrice
    );

    return NextResponse.json(intrinsicValue);
  } catch (error) {
    console.error("Intrinsic value calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate intrinsic value" },
      { status: 500 }
    );
  }
}