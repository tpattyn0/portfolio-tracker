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
  Info,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

interface TechnicalAnalysisProps {
  symbol: string;
  currency?: string;
}

export function TechnicalAnalysis({ symbol, currency }: TechnicalAnalysisProps) {
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
          <div className="flex items-center justify-center h-32 text-mut">
            <AlertCircle className="mr-2 h-4 w-4" />
            Unable to load technical analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  const indicators = data.indicators;
  const signal = indicators.signal;
  // Use the actual calculated score from the backend instead of mapping signal
  const signalScore = typeof indicators.score === 'number' ? indicators.score : 5;
  const currentPrice = data.chart[data.chart.length - 1]?.value;

  // v2.0 enhancements
  const confidence = indicators.confidence || 'MEDIUM';
  const confidenceStars = indicators.confidenceStars || 2;
  const breakdown = indicators.breakdown || {};
  const warnings = indicators.warnings || [];
  const agreement = indicators.agreement || 0;
  const indicatorsUsed = indicators.indicatorsUsed || 0;

  return (
    <div className="space-y-4">
      {/* Overall Signal - Enhanced v2.0 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Technical Signal</span>
            {/* Confidence Stars */}
            <div className="flex items-center space-x-1">
              {[...Array(3)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i < confidenceStars ? "fill-amber text-amber" : "text-mut"
                  )}
                />
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {signal.includes("BUY") ? (
                  <TrendingUp className="h-5 w-5 text-up" />
                ) : signal.includes("SELL") ? (
                  <TrendingDown className="h-5 w-5 text-dn" />
                ) : signal === "INSUFFICIENT_DATA" ? (
                  <AlertCircle className="h-5 w-5 text-amber" />
                ) : (
                  <Activity className="h-5 w-5 text-sub" />
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
                signalScore >= 7 ? "[&>div]:bg-up" :
                signalScore <= 3 ? "[&>div]:bg-dn" :
                "[&>div]:bg-mut"
              )}
            />

            {/* v2.0: Confidence and Agreement */}
            <div className="flex items-center justify-between text-xs text-sub">
              <span>
                Confidence: <span className={cn(
                  "font-medium",
                  confidence === "HIGH" ? "text-up" :
                  confidence === "MEDIUM" ? "text-foreground" :
                  "text-amber"
                )}>
                  {confidence}
                </span>
              </span>
              {agreement > 0 && (
                <span>
                  Agreement: <span className="font-medium">{agreement.toFixed(0)}%</span>
                </span>
              )}
              {indicatorsUsed > 0 && (
                <span>
                  Indicators: <span className="font-medium">{indicatorsUsed}/9</span>
                </span>
              )}
            </div>

            <p className="text-sm text-sub">
              {signalScore >= 8
                ? "Strong bullish signals across multiple indicators"
                : signalScore >= 6
                ? "Moderate bullish signals - positive trend indicated"
                : signalScore <= 2
                ? "Strong bearish signals suggest caution"
                : signalScore <= 4
                ? "Bearish signals - negative trend indicated"
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
                value={formatCurrency(indicators.sma20, currency)}
                status={getMAStatus(currentPrice, indicators.sma20)}
                signal={breakdown.trend?.sma20?.signal}
                points={breakdown.trend?.sma20?.points}
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
                value={formatCurrency(indicators.sma50, currency)}
                status={getMAStatus(currentPrice, indicators.sma50)}
                signal={breakdown.trend?.sma50?.signal}
                points={breakdown.trend?.sma50?.points}
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
                value={formatCurrency(indicators.sma200, currency)}
                status={getMAStatus(currentPrice, indicators.sma200)}
                signal={breakdown.trend?.sma200?.signal}
                points={breakdown.trend?.sma200?.points}
                interpretation={
                  currentPrice && currentPrice > indicators.sma200
                    ? "In long-term uptrend"
                    : "In long-term downtrend"
                }
              />
            )}

            {/* Golden/Death Cross - Enhanced v2.0 */}
            {indicators.sma50 && indicators.sma200 && (
              <div className={cn(
                "mt-3 p-3 rounded-md",
                indicators.sma50 > indicators.sma200 ? "bg-fill" : "bg-fill"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Info className={cn(
                      "h-4 w-4",
                      indicators.sma50 > indicators.sma200 ? "text-up" : "text-dn"
                    )} />
                    <p className="text-sm font-medium">
                      {indicators.sma50 > indicators.sma200 ? "Golden Cross" : "Death Cross"}
                    </p>
                  </div>
                  {breakdown.trend?.goldenCross?.points && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        breakdown.trend.goldenCross.signal === 'bullish' ? "text-up border-up" :
                        breakdown.trend.goldenCross.signal === 'bearish' ? "text-dn border-dn" : ""
                      )}
                    >
                      {breakdown.trend.goldenCross.signal === 'bullish' ? '+' : breakdown.trend.goldenCross.signal === 'bearish' ? '-' : ''}{breakdown.trend.goldenCross.points} pts
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-sub mt-1">
                  {indicators.sma50 > indicators.sma200
                    ? "50-day MA above 200-day MA - bullish long-term signal"
                    : "50-day MA below 200-day MA - bearish long-term signal"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Momentum Indicators - Enhanced v2.0 */}
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
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      "text-sm font-medium",
                      indicators.rsi14 > 70 ? "text-dn" :
                      indicators.rsi14 < 30 ? "text-up" :
                      "text-sub"
                    )}>
                      {indicators.rsi14.toFixed(2)}
                    </span>
                    {breakdown.momentum?.rsi?.points && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          breakdown.momentum.rsi.signal === 'bullish' ? "text-up border-up" :
                          breakdown.momentum.rsi.signal === 'bearish' ? "text-dn border-dn" : ""
                        )}
                      >
                        {breakdown.momentum.rsi.signal === 'bullish' ? '+' : breakdown.momentum.rsi.signal === 'bearish' ? '-' : ''}{breakdown.momentum.rsi.points} pts
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress
                  value={indicators.rsi14}
                  className="h-1.5 mt-1"
                />
                <div className="mt-1 text-xs text-sub">
                  {breakdown.momentum?.rsi?.details?.category ||
                   (indicators.rsi14 > 70 ? "Overbought (Reversal)" :
                    indicators.rsi14 < 30 ? "Oversold (Reversal)" :
                    indicators.rsi14 >= 50 ? "Bullish Momentum" : "Bearish Momentum")}
                </div>
              </div>
            )}

            {indicators.macd && indicators.macd.value !== null && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">MACD</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{indicators.macd.value.toFixed(4)}</span>
                    {breakdown.momentum?.macd?.points && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          breakdown.momentum.macd.signal === 'bullish' ? "text-up border-up" :
                          breakdown.momentum.macd.signal === 'bearish' ? "text-dn border-dn" : ""
                        )}
                      >
                        {breakdown.momentum.macd.signal === 'bullish' ? '+' : breakdown.momentum.macd.signal === 'bearish' ? '-' : ''}{breakdown.momentum.macd.points} pts
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-sub">
                  Signal: {indicators.macd.signal?.toFixed(4) || "-"}
                </div>
                <div className="text-xs text-sub">
                  {indicators.macd.value > (indicators.macd.signal || 0)
                    ? "MACD above signal - bullish momentum"
                    : "MACD below signal - bearish momentum"}
                </div>
              </div>
            )}

            {/* v2.0: Stochastic Oscillator */}
            {indicators.stochastic && indicators.stochastic.k !== null && (
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Stochastic</span>
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      "text-sm font-medium",
                      indicators.stochastic.k > 80 ? "text-dn" :
                      indicators.stochastic.k < 20 ? "text-up" :
                      "text-sub"
                    )}>
                      %K: {indicators.stochastic.k.toFixed(1)}
                    </span>
                    {breakdown.momentum?.stochastic?.points && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          breakdown.momentum.stochastic.signal === 'bullish' ? "text-up border-up" :
                          breakdown.momentum.stochastic.signal === 'bearish' ? "text-dn border-dn" : ""
                        )}
                      >
                        {breakdown.momentum.stochastic.signal === 'bullish' ? '+' : breakdown.momentum.stochastic.signal === 'bearish' ? '-' : ''}{breakdown.momentum.stochastic.points} pts
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress
                  value={indicators.stochastic.k}
                  className="h-1.5 mt-1"
                />
                <div className="mt-1 text-xs text-sub">
                  %D: {indicators.stochastic.d?.toFixed(1) || "N/A"} | {
                    indicators.stochastic.k > 80 ? "Overbought - potential pullback" :
                    indicators.stochastic.k < 20 ? "Oversold - potential reversal" :
                    indicators.stochastic.k > (indicators.stochastic.d || 0) ? "Bullish crossover" :
                    "Bearish crossover"
                  }
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bollinger Bands - Enhanced v2.0 */}
      {indicators.bollingerBands && indicators.bollingerBands.middle !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Bollinger Bands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <IndicatorRow
                label="Upper Band"
                value={formatCurrency(indicators.bollingerBands.upper || 0, currency)}
              />
              <IndicatorRow
                label="Middle Band"
                value={formatCurrency(indicators.bollingerBands.middle || 0, currency)}
              />
              <IndicatorRow
                label="Lower Band"
                value={formatCurrency(indicators.bollingerBands.lower || 0, currency)}
              />
              <div className="mt-3 p-3 bg-fill rounded-md">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-sub">
                    {breakdown.volatility?.bollinger?.details?.position ||
                     (currentPrice && currentPrice > indicators.bollingerBands.upper
                      ? "Above Upper Band - Overbought"
                      : currentPrice && currentPrice < indicators.bollingerBands.lower
                      ? "Below Lower Band - Oversold"
                      : "Within Bands - Normal Volatility")}
                  </p>
                  {breakdown.volatility?.bollinger?.points && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        breakdown.volatility.bollinger.signal === 'bullish' ? "text-up border-up" :
                        breakdown.volatility.bollinger.signal === 'bearish' ? "text-dn border-dn" : ""
                      )}
                    >
                      {breakdown.volatility.bollinger.signal === 'bullish' ? '+' : breakdown.volatility.bollinger.signal === 'bearish' ? '-' : ''}{breakdown.volatility.bollinger.points} pts
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volume Analysis - v2.0 (with warnings integrated) */}
      {indicators.volumeTrend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-4 w-4" />
              Volume Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <IndicatorRow
                label="Current Volume"
                value={formatVolume(indicators.volumeTrend.currentVolume)}
              />
              <IndicatorRow
                label="Average Volume (20d)"
                value={formatVolume(indicators.volumeTrend.avgVolume)}
              />
              {indicators.volumeTrend.changePercent !== null && (
                <div className="mt-3 p-3 bg-fill rounded-md">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-sub">
                      Volume is {indicators.volumeTrend.changePercent > 0 ? 'up' : 'down'}{' '}
                      {Math.abs(indicators.volumeTrend.changePercent).toFixed(1)}% vs 20-day average
                      {breakdown.volume?.volumeTrend?.details?.interpretation && ` - ${breakdown.volume.volumeTrend.details.interpretation}`}
                    </p>
                    {breakdown.volume?.volumeTrend?.points !== undefined && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          breakdown.volume.volumeTrend.signal === 'bullish' ? "text-up border-up" :
                          breakdown.volume.volumeTrend.signal === 'bearish' ? "text-dn border-dn" : ""
                        )}
                      >
                        {breakdown.volume.volumeTrend.signal === 'bullish' ? '+' : breakdown.volume.volumeTrend.signal === 'bearish' ? '-' : ''}{breakdown.volume.volumeTrend.points} pts
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {/* Integrated Warnings */}
              {warnings.length > 0 && (
                <div className="mt-4 p-3 bg-fill border border-border rounded-md">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber" />
                    <span className="text-sm font-semibold text-amber">Important Considerations</span>
                  </div>
                  <ul className="space-y-1">
                    {warnings.map((warning: string, idx: number) => (
                      <li key={idx} className="text-xs text-amber flex items-start">
                        <span className="mr-2">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary - Enhanced v2.0 */}
      <Card className="bg-fill border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-foreground" />
            <span>Analysis Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sub">
            Technical analysis shows a <span className="font-semibold">{signal.replace(/_/g, " ")}</span> signal
            with {confidence.toLowerCase()} confidence ({confidenceStars}/3 stars).
            {signalScore >= 8
              ? " Multiple indicators confirm strong bullish momentum."
              : signalScore >= 6
              ? " Indicators suggest positive trend with room to run."
              : signalScore <= 2
              ? " Multiple indicators suggest strong bearish pressure."
              : signalScore <= 4
              ? " Indicators show bearish trend - exercise caution."
              : " Indicators show mixed signals - consider waiting."}
          </p>
          {indicators.bullishPoints > 0 && indicators.bearishPoints > 0 && (
            <p className="text-xs text-sub mt-2">
              Bullish signals: {indicators.bullishPoints.toFixed(1)} pts |
              Bearish signals: {indicators.bearishPoints.toFixed(1)} pts |
              Total weight: {indicators.availableWeight} pts
            </p>
          )}
          <p className="text-xs text-sub mt-2">
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
  signal?: "bullish" | "bearish" | "neutral";
  points?: number;
  interpretation?: string;
}

function IndicatorRow({ label, value, status, signal, points, interpretation }: IndicatorRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-sub">{label}</span>
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
          {points !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                signal === 'bullish' ? "text-up border-up" :
                signal === 'bearish' ? "text-dn border-dn" : ""
              )}
            >
              {signal === 'bullish' ? '+' : signal === 'bearish' ? '-' : ''}{points} pts
            </Badge>
          )}
        </div>
      </div>
      {interpretation && (
        <p className="text-xs text-mut">{interpretation}</p>
      )}
    </div>
  );
}

function getMAStatus(currentPrice: number | undefined, ma: number): "above" | "below" | "neutral" {
  if (!currentPrice) return "neutral";
  if (currentPrice > ma * 1.001) return "above";
  if (currentPrice < ma * 0.999) return "below";
  return "neutral";
}

function formatVolume(volume: number | null): string {
  if (!volume) return "N/A";
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toFixed(0);
}
