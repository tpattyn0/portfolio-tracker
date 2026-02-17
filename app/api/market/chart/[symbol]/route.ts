import { NextRequest, NextResponse } from "next/server";
import { marketDataService } from "@/lib/services/market-data.service";
import { technicalAnalysisService } from "@/lib/services/technical-analysis.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "1M") as any;

    // Fetch data for display AND analysis
    const [chartData, historicalForAnalysis] = await Promise.all([
      marketDataService.getHistoricalData(symbol, period),
      // Always try to get at least 1 year for complete technical analysis (need 205+ points for SMA 200)
      marketDataService.getHistoricalData(symbol, "1Y")
    ]);

    console.log(`Chart data for ${symbol}:`, {
      displayPeriod: period,
      displayPoints: chartData.length,
      analysisPoints: historicalForAnalysis.length
    });

    const prices = historicalForAnalysis.map(d => d.value);
    const volumes = historicalForAnalysis.map(d => d.volume);
    const indicators = technicalAnalysisService.calculateIndicators(prices, volumes);

    console.log(`Technical indicators for ${symbol}:`, {
      signal: indicators.signal,
      confidence: indicators.confidence,
      indicatorsUsed: indicators.indicatorsUsed,
      hasRSI: indicators.rsi14 !== null,
      hasSMA20: indicators.sma20 !== null,
      hasSMA50: indicators.sma50 !== null,
      hasSMA200: indicators.sma200 !== null,
      hasMACD: indicators.macd.value !== null,
      hasVolume: indicators.volumeTrend !== undefined
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