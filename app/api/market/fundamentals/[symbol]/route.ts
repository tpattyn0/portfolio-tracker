// app/api/market/fundamentals/[symbol]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/auth";
import { fundamentalAnalysisService } from "@/lib/services/fundamental-analysis.service";
import { getWeights } from "@/lib/services/scoring-preferences.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { symbol } = await params;

    // Per-user fundamental reweight (plans/2026-07-20-configurable-scoring-weights.md,
    // ADR-21): the route reads the user's weights and passes them in — the
    // service itself never reads UserScoringPreferences (ADR-3).
    const weights = await getWeights(auth.userId);
    const fundamentals = await fundamentalAnalysisService.fetchFundamentals(
      symbol,
      weights.fundamental
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