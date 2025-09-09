import { NextRequest, NextResponse } from "next/server";
import { marketDataService } from "@/lib/services/market-data.service";
import { technicalAnalysisService } from "@/lib/services/technical-analysis.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "1M") as any;

    // Fetch data for display AND analysis
    const [chartData, historicalForAnalysis] = await Promise.all([
      marketDataService.getHistoricalData(params.symbol, period),
      // Always try to get at least 6 months for better technical analysis
      marketDataService.getHistoricalData(params.symbol, "6M")
    ]);

    console.log(`Chart data for ${params.symbol}:`, {
      displayPeriod: period,
      displayPoints: chartData.length,
      analysisPoints: historicalForAnalysis.length
    });

    const prices = historicalForAnalysis.map(d => d.value);
    const indicators = technicalAnalysisService.calculateIndicators(prices);

    console.log(`Technical indicators for ${params.symbol}:`, {
      signal: indicators.signal,
      hasRSI: indicators.rsi14 !== null,
      hasSMA20: indicators.sma20 !== null,
      hasSMA50: indicators.sma50 !== null,
      hasMACD: indicators.macd.value !== null
    });

    return NextResponse.json({
      chart: chartData,
      indicators,
      period
    });
  } catch (error) {
    console.error("Chart fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}