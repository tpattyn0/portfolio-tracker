// app/api/market/fundamentals/[symbol]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fundamentalAnalysisService } from "@/lib/services/fundamental-analysis.service";

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fundamentals = await fundamentalAnalysisService.fetchFundamentals(
      params.symbol
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