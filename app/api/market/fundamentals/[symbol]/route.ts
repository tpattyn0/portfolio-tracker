// app/api/market/fundamentals/[symbol]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fundamentalAnalysisService } from "@/lib/services/fundamental-analysis.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { symbol } = await params;
    const fundamentals = await fundamentalAnalysisService.fetchFundamentals(
      symbol
    );

    return NextResponse.json(fundamentals);
  } catch (error) {
    console.error("Fundamentals fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fundamental data" },
      { status: 500 }
    );
  }
}