import { NextRequest, NextResponse } from "next/server";
import { marketDataService } from "@/lib/services/market-data.service";
import { technicalAnalysisService } from "@/lib/services/technical-analysis.service";
import { getAuthenticatedUser } from "@/lib/utils/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "1M") as any;

    // Fetch data for display AND analysis
    const [chartData, historicalForAnalysis] = await Promise.all([
      marketDataService.getHistoricalData(symbol, period),
      // Always try to get at least 1 year for complete technical analysis (need 205+ points for SMA 200)
      marketDataService.getHistoricalData(symbol, "1Y")
    ]);

    const prices = historicalForAnalysis.map(d => d.value);
    const volumes = historicalForAnalysis.map(d => d.volume);
    const indicators = technicalAnalysisService.getCachedIndicators(symbol, prices, volumes);

    return NextResponse.json(
      {
        chart: chartData,
        indicators,
        period
      },
      {
        headers: {
          // Matches the underlying market-data.service history cache TTL
          // (60s) and the indicator cache TTL — a refetch within that
          // window is cheap for both client and server (plan Task 3).
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("Chart fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}