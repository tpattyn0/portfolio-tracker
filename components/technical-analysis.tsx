"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Activity,
  BarChart3,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

interface TechnicalAnalysisProps {
  symbol: string;
}

export function TechnicalAnalysis({ symbol }: TechnicalAnalysisProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["technical-analysis", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=1Y`);
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Technical Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.indicators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Technical Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            <AlertCircle className="mr-2 h-4 w-4" />
            Unable to load technical analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  const indicators = data.indicators;
  const signal = indicators.signal;
  const signalScore = getSignalScore(signal);
  const currentPrice = data.chart[data.chart.length - 1]?.value;

  return (
    <div className="space-y-4">
      {/* Overall Signal */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {signal.includes("BUY") ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : signal.includes("SELL") ? (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                ) : (
                  <Activity className="h-5 w-5 text-gray-600" />
                )}
                <span className="text-lg font-semibold">
                  {signal.replace(/_/g, " ")}
                </span>
              </div>
              <Badge
                variant={
                  signal.includes("BUY")
                    ? "default"
                    : signal.includes("SELL")
                    ? "destructive"
                    : "secondary"
                }
              >
                Score: {signalScore}/10
              </Badge>
            </div>
            <Progress 
              value={signalScore * 10} 
              className={cn(
                "h-2",
                signalScore >= 7 ? "[&>div]:bg-green-600" :
                signalScore <= 3 ? "[&>div]:bg-red-600" :
                "[&>div]:bg-gray-400"
              )}
            />
            <p className="text-sm text-gray-600">
              {signalScore >= 7 
                ? "Strong bullish signals across multiple indicators"
                : signalScore <= 3
                ? "Strong bearish signals suggest caution"
                : "Mixed signals - consider waiting for clearer direction"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Moving Averages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-4 w-4" />
            Moving Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {indicators.sma20 && (
              <IndicatorRow
                label="SMA (20)"
                value={formatCurrency(indicators.sma20)}
                status={getMAStatus(currentPrice, indicators.sma20)}
                interpretation={
                  currentPrice && currentPrice > indicators.sma20
                    ? "Price above short-term average"
                    : "Price below short-term average"
                }
              />
            )}
            {indicators.sma50 && (
              <IndicatorRow
                label="SMA (50)"
                value={formatCurrency(indicators.sma50)}
                status={getMAStatus(currentPrice, indicators.sma50)}
                interpretation={
                  currentPrice && currentPrice > indicators.sma50
                    ? "Above medium-term trend"
                    : "Below medium-term trend"
                }
              />
            )}
            {indicators.sma200 && (
              <IndicatorRow
                label="SMA (200)"
                value={formatCurrency(indicators.sma200)}
                status={getMAStatus(currentPrice, indicators.sma200)}
                interpretation={
                  currentPrice && currentPrice > indicators.sma200
                    ? "In long-term uptrend"
                    : "In long-term downtrend"
                }
              />
            )}
            
            {/* Golden/Death Cross */}
            {indicators.sma50 && indicators.sma200 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium">
                    {indicators.sma50 > indicators.sma200 ? "Golden Cross" : "Death Cross"}
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {indicators.sma50 > indicators.sma200
                    ? "50-day MA above 200-day MA - bullish long-term signal"
                    : "50-day MA below 200-day MA - bearish long-term signal"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Momentum Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-4 w-4" />
            Momentum Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {indicators.rsi14 !== null && (
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">RSI (14)</span>
                  <span className={cn(
                    "text-sm font-medium",
                    indicators.rsi14 > 70 ? "text-red-600" :
                    indicators.rsi14 < 30 ? "text-green-600" :
                    "text-gray-600"
                  )}>
                    {indicators.rsi14.toFixed(2)}
                  </span>
                </div>
                <Progress 
                  value={indicators.rsi14} 
                  className="h-1.5 mt-1"
                />
                <div className="mt-1 text-xs text-gray-600">
                  {indicators.rsi14 > 70 ? "Overbought - potential pullback ahead" :
                   indicators.rsi14 < 30 ? "Oversold - potential bounce opportunity" :
                   "Neutral momentum"}
                </div>
              </div>
            )}
            
            {indicators.macd && indicators.macd.value !== null && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">MACD</span>
                  <span className="text-sm">{indicators.macd.value.toFixed(4)}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Signal: {indicators.macd.signal?.toFixed(4) || "-"}
                </div>
                <div className="text-xs text-gray-600">
                  {indicators.macd.value > (indicators.macd.signal || 0)
                    ? "MACD above signal - bullish momentum"
                    : "MACD below signal - bearish momentum"}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bollinger Bands */}
      {indicators.bollingerBands && indicators.bollingerBands.middle !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Bollinger Bands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <IndicatorRow
                label="Upper Band"
                value={formatCurrency(indicators.bollingerBands.upper || 0)}
              />
              <IndicatorRow
                label="Middle Band"
                value={formatCurrency(indicators.bollingerBands.middle || 0)}
              />
              <IndicatorRow
                label="Lower Band"
                value={formatCurrency(indicators.bollingerBands.lower || 0)}
              />
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-600">
                  {currentPrice && currentPrice > indicators.bollingerBands.upper
                    ? "Price above upper band - potentially overbought"
                    : currentPrice && currentPrice < indicators.bollingerBands.lower
                    ? "Price below lower band - potentially oversold"
                    : "Price within bands - normal volatility"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <span>Analysis Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">
            Technical analysis shows a <span className="font-semibold">{signal.replace(/_/g, " ")}</span> signal 
            with a strength of {signalScore}/10. 
            {signalScore >= 7 
              ? " Multiple indicators confirm bullish momentum."
              : signalScore <= 3
              ? " Multiple indicators suggest bearish pressure."
              : " Indicators show mixed signals - be cautious."}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Always combine technical analysis with fundamental research and proper risk management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface IndicatorRowProps {
  label: string; 
  value: string; 
  status?: "above" | "below" | "neutral";
  interpretation?: string;
}

function IndicatorRow({ label, value, status, interpretation }: IndicatorRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{value}</span>
          {status && (
            <Badge 
              variant={status === "above" ? "default" : status === "below" ? "secondary" : "outline"}
              className="text-xs"
            >
              {status === "above" ? "Above" : status === "below" ? "Below" : "At"}
            </Badge>
          )}
        </div>
      </div>
      {interpretation && (
        <p className="text-xs text-gray-500">{interpretation}</p>
      )}
    </div>
  );
}

function getSignalScore(signal: string): number {
  switch (signal) {
    case "STRONG_BUY": return 9;
    case "BUY": return 7;
    case "HOLD": return 5;
    case "SELL": return 3;
    case "STRONG_SELL": return 1;
    default: return 5;
  }
}

function getMAStatus(currentPrice: number | undefined, ma: number): "above" | "below" | "neutral" {
  if (!currentPrice) return "neutral";
  if (currentPrice > ma * 1.001) return "above";
  if (currentPrice < ma * 0.999) return "below";
  return "neutral";
}