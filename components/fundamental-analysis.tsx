"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { FundamentalMetricsResponse } from "@/lib/types/market";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Heart,
  AlertCircle,
  Info,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

interface FundamentalAnalysisProps {
  symbol: string;
  currency?: string;
}

// Helper function to format percentages
const formatPercentLocal = (value: number | null): string => {
  if (value === null || value === undefined) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
};

export function FundamentalAnalysis({ symbol, currency }: FundamentalAnalysisProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/fundamentals/${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch fundamentals");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return <FundamentalAnalysisSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64 text-gray-500">
          <AlertCircle className="mr-2 h-5 w-5" />
          Unable to load fundamental analysis
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 7) return { label: "Strong", variant: "default" as const };
    if (score >= 5) return { label: "Moderate", variant: "secondary" as const };
    return { label: "Weak", variant: "destructive" as const };
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Fundamental Score
            </span>
            <Badge variant={getScoreBadge(data.score.total).variant} className="text-lg px-3 py-1">
              {data.score.total}/10
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={data.score.total * 10} className="h-3" />

            <p className="text-sm text-gray-600">
              {data.score.interpretation}
            </p>

            {/* Score Breakdown Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <ScoreCard
                title="Valuation"
                score={data.score.breakdown.valuation}
                icon={DollarSign}
              />
              <ScoreCard
                title="Profitability"
                score={data.score.breakdown.profitability}
                icon={TrendingUp}
              />
              <ScoreCard
                title="Growth"
                score={data.score.breakdown.growth}
                icon={Activity}
              />
              <ScoreCard
                title="Health"
                score={data.score.breakdown.financial}
                icon={Heart}
              />
              <ScoreCard
                title="Dividend"
                score={data.score.breakdown.dividend}
                icon={Wallet}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="valuation" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="financial">Health</TabsTrigger>
          <TabsTrigger value="dividend">Dividend</TabsTrigger>
        </TabsList>

        {/* Valuation Tab */}
        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Valuation Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Valuation Ratios Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                    Valuation Ratios
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <MetricRow
                      label="P/E Ratio"
                      value={data.valuation.peRatio}
                      format="number"
                      tooltip="Price to Earnings (Trailing) - < 20 is good, > 30 is high"
                      goodThreshold={20}
                      badThreshold={30}
                      inverse
                    />
                    <MetricRow
                      label="Forward P/E"
                      value={data.valuation.forwardPE}
                      format="number"
                      tooltip="Forward P/E - < 15 is attractive, > 25 is premium"
                      goodThreshold={15}
                      badThreshold={25}
                      inverse
                    />
                    <MetricRow
                      label="PEG Ratio"
                      value={data.valuation.pegRatio}
                      format="number"
                      tooltip="PEG Ratio - < 1 is undervalued, > 2 is overvalued"
                      goodThreshold={1}
                      badThreshold={2}
                      inverse
                    />
                    <MetricRow
                      label="P/S Ratio"
                      value={data.valuation.psRatio}
                      format="number"
                      tooltip="Price to Sales - < 1.5 is good value, > 5 is high"
                      goodThreshold={1.5}
                      badThreshold={5}
                      inverse
                    />
                    <MetricRow
                      label="P/B Ratio"
                      value={data.valuation.pbRatio}
                      format="number"
                      tooltip="Price to Book - < 1.5 is value, > 3 is premium"
                      goodThreshold={1.5}
                      badThreshold={3}
                      inverse
                    />
                    <MetricRow
                      label="P/FCF Ratio"
                      value={data.valuation.pfcfRatio}
                      format="number"
                      tooltip="Price to Free Cash Flow - < 15 is attractive"
                      goodThreshold={15}
                      badThreshold={30}
                      inverse
                    />
                    <MetricRow
                      label="FCF Yield"
                      value={data.valuation.pfcfRatio ? 1 / data.valuation.pfcfRatio : null}
                      format="percentDecimal"
                      tooltip="Free Cash Flow Yield - > 5% is attractive"
                      goodThreshold={0.05}
                      badThreshold={0.02}
                    />
                    <MetricRow
                      label="EV/EBITDA"
                      value={data.valuation.evToEbitda}
                      format="number"
                      tooltip="Enterprise Value to EBITDA - < 10 is value"
                      goodThreshold={10}
                      badThreshold={20}
                      inverse
                    />
                  </div>
                </div>

                {/* Per-Share Metrics Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                    Per-Share Metrics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <MetricRow
                      label="EPS"
                      value={data.valuation.eps}
                      format="currency"
                      tooltip="Earnings Per Share - Profit per outstanding share"
                      currency={currency}
                    />
                    <MetricRow
                      label="Forward EPS"
                      value={data.valuation.forwardEps}
                      format="currency"
                      tooltip="Forward Earnings Per Share - Expected future earnings per share"
                      currency={currency}
                    />
                    <MetricRow
                      label="Book Value"
                      value={data.valuation.bookValue}
                      format="currency"
                      currency={currency}
                      tooltip="Book Value Per Share - Net asset value per share"
                    />
                  </div>
                </div>

                {/* Company Size Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                    Company Size
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <MetricRow
                      label="Market Cap"
                      value={data.valuation.marketCap}
                      format="largeNumber"
                      currency={currency}
                      tooltip="Total market value of the company"
                    />
                    <MetricRow
                      label="Enterprise Value"
                      value={data.valuation.enterpriseValue}
                      format="largeNumber"
                      currency={currency}
                      tooltip="Market Cap + Debt - Cash. The theoretical takeover price."
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability Tab */}
        <TabsContent value="profitability">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Profitability Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <MetricRow
                  label="Profit Margin"
                  value={data.profitability.profitMargin}
                  format="percentDecimal"
                  tooltip="Net profit as % of revenue - Higher is better"
                  benchmark={0.1}
                />
                <MetricRow
                  label="Operating Margin"
                  value={data.profitability.operatingMargin}
                  format="percentDecimal"
                  tooltip="Operating profit as % of revenue"
                  benchmark={0.15}
                />
                <MetricRow
                  label="Return on Equity (ROE)"
                  value={data.profitability.roe}
                  format="percentDecimal"
                  tooltip="Profit generated per euro of equity"
                  benchmark={0.15}
                />
                <MetricRow
                  label="Return on Assets (ROA)"
                  value={data.profitability.roa}
                  format="percentDecimal"
                  tooltip="Profit generated per euro of assets"
                  benchmark={0.05}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Growth Tab */}
        <TabsContent value="growth">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Growth Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <MetricRow
                  label="Revenue Growth"
                  value={data.growth.revenueGrowth}
                  format="percentDecimal"
                  tooltip="Year-over-year revenue growth rate"
                  benchmark={0.1}
                  showTrend
                />
                <MetricRow
                  label="Earnings Growth"
                  value={data.growth.earningsGrowth}
                  format="percentDecimal"
                  tooltip="Year-over-year earnings growth rate"
                  benchmark={0.1}
                  showTrend
                />
                {data.growth.fcfGrowth !== null && (
                  <MetricRow
                    label="Free Cash Flow Growth"
                    value={data.growth.fcfGrowth}
                    format="percentDecimal"
                    tooltip="Year-over-year FCF growth rate"
                    benchmark={0.1}
                    showTrend
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Health Tab */}
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="mr-2 h-5 w-5" />
                Financial Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <MetricRow
                  label="Current Ratio"
                  value={data.financial.currentRatio}
                  format="number"
                  tooltip="Current assets / Current liabilities - Above 1 is healthy"
                  benchmark={1.5}
                />
                <MetricRow
                  label="Quick Ratio"
                  value={data.financial.quickRatio}
                  format="number"
                  tooltip="Liquid assets / Current liabilities - Above 1 is good"
                  benchmark={1}
                />
                <MetricRow
                  label="Debt to Equity"
                  value={data.financial.debtToEquity}
                  format="number"
                  tooltip="Total debt / Total equity - Lower is safer"
                  benchmark={1}
                  inverse
                />
                {data.financial.interestCoverage !== null && (
                  <MetricRow
                    label="Interest Coverage"
                    value={data.financial.interestCoverage}
                    format="number"
                    tooltip="EBIT / Interest expense - Higher is better"
                    benchmark={3}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dividend Tab */}
        <TabsContent value="dividend">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                Dividend Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.dividend.yield || data.dividend.payoutRatio ? (
                <div className="space-y-4">
                  <MetricRow
                    label="Dividend Yield"
                    value={data.dividend.yield}
                    format="percentDecimal"
                    tooltip="Annual dividend / Share price"
                    benchmark={0.02}
                  />
                  <MetricRow
                    label="Payout Ratio"
                    value={data.dividend.payoutRatio}
                    format="percentDecimal"
                    tooltip="Dividends / Earnings - Below 60% is sustainable"
                    benchmark={0.6}
                    inverse
                  />
                  {data.dividend.growthRate !== null && (
                    <MetricRow
                      label="5-Year Dividend Growth"
                      value={data.dividend.growthRate}
                      format="percentDecimal"
                      tooltip="Average annual dividend growth rate"
                      benchmark={0.05}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Wallet className="mx-auto h-12 w-12 mb-2 opacity-30" />
                  <p>No dividend data available</p>
                  <p className="text-sm mt-1">This company may not pay dividends</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Key Insights */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5 text-blue-600" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {generateInsights(data).map((insight, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// Score Card Component
interface ScoreCardProps {
  title: string;
  score: number;
  icon: React.ComponentType<{ className?: string }>;
}

function ScoreCard({ title, score, icon: Icon }: ScoreCardProps) {
  const getColor = (score: number) => {
    if (score >= 7) return "text-green-600 bg-green-50";
    if (score >= 5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className={cn("p-3 rounded-lg text-center", getColor(score).split(" ")[1])}>
      <Icon className={cn("h-5 w-5 mx-auto mb-1", getColor(score).split(" ")[0])} />
      <p className="text-xs text-gray-600">{title}</p>
      <p className={cn("text-lg font-bold", getColor(score).split(" ")[0])}>
        {score.toFixed(1)}
      </p>
    </div>
  );
}

// Metric Row Component
interface MetricRowProps {
  label: string;
  value: number | null;
  format: "number" | "percentDecimal" | "currency" | "largeNumber";
  tooltip?: string;
  // New benchmark system:
  // goodThreshold: value better than this is GOOD (Green)
  // badThreshold: value worse than this is BAD (Red)
  // In between is NEUTRAL (Yellow)
  goodThreshold?: number;
  badThreshold?: number;
  inverse?: boolean; // if true, lower is better. default false (higher is better)

  // Legacy support (optional, converts to binary good/bad if used alone)
  benchmark?: number;

  showTrend?: boolean;
  currency?: string;
}

function MetricRow({
  label,
  value,
  format,
  tooltip,
  goodThreshold,
  badThreshold,
  benchmark,
  inverse = false,
  showTrend = false,
  currency
}: MetricRowProps) {
  if (value === null || value === undefined) {
    return (
      <div className="flex justify-between items-center py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-gray-600 cursor-help flex items-center">
                {label}
                {tooltip && <Info className="ml-1 h-3 w-3 opacity-50" />}
              </span>
            </TooltipTrigger>
            {tooltip && (
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <span className="text-sm text-gray-400">N/A</span>
      </div>
    );
  }

  let formattedValue = "";

  // Color Logic
  let colorClass = "text-gray-900"; // default

  if (goodThreshold !== undefined && badThreshold !== undefined) {
    // 3-tier logic
    if (inverse) {
      if (value <= goodThreshold) colorClass = "text-green-600";
      else if (value >= badThreshold) colorClass = "text-red-600";
      else colorClass = "text-yellow-600";
    } else {
      if (value >= goodThreshold) colorClass = "text-green-600";
      else if (value <= badThreshold) colorClass = "text-red-600";
      else colorClass = "text-yellow-600";
    }
  } else if (benchmark !== undefined) {
    // Legacy binary logic
    const isGood = inverse ? value < benchmark : value > benchmark;
    colorClass = isGood ? "text-green-600" : "text-red-600";
  }

  switch (format) {
    case "percentDecimal":
      formattedValue = value >= 0 ? `+${(value * 100).toFixed(2)}%` : `${(value * 100).toFixed(2)}%`;
      break;
    case "currency":
      formattedValue = formatCurrency(value, currency);
      break;
    case "largeNumber":
      const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency || '$';
      formattedValue = value >= 1e9
        ? `${currencySymbol}${(value / 1e9).toFixed(2)}B`
        : value >= 1e6
          ? `${currencySymbol}${(value / 1e6).toFixed(2)}M`
          : formatCurrency(value, currency);
      break;
    default:
      formattedValue = value.toFixed(2);
  }

  return (
    <div className="flex justify-between items-center py-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-gray-600 cursor-help flex items-center">
              {label}
              {tooltip && <Info className="ml-1 h-3 w-3 opacity-50" />}
            </span>
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent>
              <p className="max-w-xs">{tooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center space-x-2">
        {showTrend && value !== 0 && (
          value > 0
            ? <ArrowUpRight className="h-4 w-4 text-green-600" />
            : <ArrowDownRight className="h-4 w-4 text-red-600" />
        )}
        <span className={cn("text-sm font-medium", colorClass)}>
          {formattedValue}
        </span>
      </div>
    </div>
  );
}

// Generate insights based on data
function generateInsights(data: FundamentalMetricsResponse): string[] {
  const insights: string[] = [];

  // Valuation insight - prioritize forward-looking metrics
  if (data.valuation.pfcfRatio && data.valuation.pfcfRatio < 15) {
    insights.push("Excellent value based on P/FCF ratio - the stock trades at an attractive price relative to free cash flow.");
  } else if (data.valuation.forwardPE && data.valuation.forwardPE < 12) {
    insights.push("Attractive forward P/E ratio suggests good value based on future earnings expectations.");
  } else if (data.valuation.peRatio && data.valuation.peRatio < 15) {
    insights.push("The stock appears undervalued based on P/E ratio compared to market average.");
  } else if (data.valuation.pfcfRatio && data.valuation.pfcfRatio > 40) {
    insights.push("High P/FCF ratio indicates expensive valuation - ensure strong growth prospects justify the premium.");
  } else if (data.valuation.forwardPE && data.valuation.forwardPE > 35) {
    insights.push("High forward P/E ratio suggests premium valuation - strong growth expectations are priced in.");
  } else if (data.valuation.peRatio && data.valuation.peRatio > 30) {
    insights.push("High P/E ratio suggests premium valuation - ensure growth justifies the price.");
  }

  // Profitability insight
  if (data.profitability.roe && data.profitability.roe > 0.2) {
    insights.push("Excellent return on equity indicates efficient use of shareholder capital.");
  }

  // Growth insight
  if (data.growth.revenueGrowth && data.growth.revenueGrowth > 0.15) {
    insights.push("Strong revenue growth shows expanding business operations.");
  }

  // Financial health insight
  if (data.financial.debtToEquity && data.financial.debtToEquity < 0.5) {
    insights.push("Conservative debt levels provide financial stability and flexibility.");
  } else if (data.financial.debtToEquity && data.financial.debtToEquity > 2) {
    insights.push("High debt levels may pose risk during economic downturns.");
  }

  // Dividend insight
  if (data.dividend.yield && data.dividend.yield > 0.03) {
    insights.push(`Attractive dividend yield of ${formatPercentLocal(data.dividend.yield)} provides income.`);
  }

  if (insights.length === 0) {
    insights.push("Mixed fundamental signals - consider additional research before investing.");
  }

  return insights;
}

// Loading skeleton
function FundamentalAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}