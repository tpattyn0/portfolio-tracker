// components/price-chart.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  symbol: string;
  name: string;
}

const periods = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
];

export function PriceChart({ symbol, name }: PriceChartProps) {
  const [period, setPeriod] = useState("1M");

  const { data, isLoading, error } = useQuery({
    queryKey: ["chart", symbol, period],
    queryFn: async () => {
      const res = await fetch(`/api/market/chart/${symbol}?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch chart data");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            Failed to load chart data
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.chart || [];
  const indicators = data.indicators || {};
  const firstValue = chartData[0]?.value || 0;
  const lastValue = chartData[chartData.length - 1]?.value || 0;
  const change = lastValue - firstValue;
  const changePercent = firstValue ? (change / firstValue) * 100 : 0;

  // Calculate technical analysis score
  let buySignals = 0;
  let totalSignals = 0;

  // Price vs MAs
  if (indicators.sma20 !== null && indicators.sma20 !== undefined) {
    totalSignals++;
    if (lastValue > indicators.sma20) buySignals++;
  }
  if (indicators.sma50 !== null && indicators.sma50 !== undefined) {
    totalSignals++;
    if (lastValue > indicators.sma50) buySignals++;
  }

  // RSI
  if (indicators.rsi14 !== null && indicators.rsi14 !== undefined) {
    totalSignals++;
    if (indicators.rsi14 < 70 && indicators.rsi14 > 30) buySignals += 0.5; // Neutral
    else if (indicators.rsi14 < 30) buySignals++; // Oversold = buy
  }

  // MACD
  if (indicators.macd?.value !== null && indicators.macd?.signal !== null) {
    totalSignals++;
    if (indicators.macd.value > indicators.macd.signal) buySignals++;
  }

  const score = totalSignals > 0 ? Math.round((buySignals / totalSignals) * 10) : 5;

  // Add moving averages to chart data
  const enhancedChartData = chartData.map((point: any) => ({
    ...point,
    sma20: indicators.sma20,
    sma50: indicators.sma50,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{name}</CardTitle>
            <p className="text-sm text-gray-600">{symbol}</p>
            <div className="mt-2">
              <span className="text-2xl font-bold">
                {formatCurrency(lastValue)}
              </span>
              <span
                className={cn(
                  "ml-2 text-sm",
                  change >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {change >= 0 ? "+" : ""}
                {formatCurrency(change)} ({changePercent >= 0 ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              {periods.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enhancedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  if (period === "1D") {
                    return date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  } else if (period === "1W") {
                    return format(date, "EEE");
                  } else if (["1M", "3M"].includes(period)) {
                    return format(date, "MMM d");
                  } else {
                    return format(date, "MMM yy");
                  }
                }}
                interval={period === "1D" ? 3 : "preserveStartEnd"}
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `€${value.toFixed(2)}`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'value' ? 'Price' : name
                ]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={change >= 0 ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                dot={false}
                name="Price"
              />
              {indicators.sma20 && (
                <Line
                  type="monotone"
                  dataKey="sma20"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="SMA 20"
                />
              )}
              {indicators.sma50 && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke="#8b5cf6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="SMA 50"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Technical Indicators Summary with Interpretations */}
        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">RSI (14)</p>
              <p className="font-medium">
                {indicators.rsi14?.toFixed(2) || "-"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {indicators.rsi14 
                  ? indicators.rsi14 > 70 
                    ? "Overbought - potential sell signal"
                    : indicators.rsi14 < 30
                    ? "Oversold - potential buy signal"
                    : "Neutral momentum"
                  : "Not enough data"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">SMA (20)</p>
              <p className="font-medium">
                {indicators.sma20 ? formatCurrency(indicators.sma20) : "-"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {indicators.sma20
                  ? lastValue > indicators.sma20
                    ? "Price above SMA - bullish"
                    : "Price below SMA - bearish"
                  : "Not enough data"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">SMA (50)</p>
              <p className="font-medium">
                {indicators.sma50 ? formatCurrency(indicators.sma50) : "-"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {indicators.sma50
                  ? lastValue > indicators.sma50
                    ? "Above medium-term trend"
                    : "Below medium-term trend"
                  : "Not enough data"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Signal</p>
              <p className={cn(
                "font-medium",
                score >= 7 ? "text-green-600" :
                score <= 3 ? "text-red-600" : "text-gray-600"
              )}>
                {indicators.signal?.replace("_", " ") || "HOLD"}
              </p>
              <p className="text-xs font-medium mt-1">
                Score: {score}/10
              </p>
            </div>
          </div>

          {/* Overall interpretation */}
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium text-gray-700">Technical Analysis Summary</p>
            <p className="text-sm text-gray-600 mt-1">
              {score >= 7 
                ? `Strong buy signals with ${buySignals} out of ${totalSignals} indicators positive. The stock shows strong momentum and is trading above key moving averages.`
                : score >= 5
                ? `Mixed signals with ${buySignals} out of ${totalSignals} indicators positive. Consider waiting for a clearer trend or use fundamental analysis to guide decisions.`
                : score >= 3
                ? `Mostly neutral to bearish signals. The stock may be consolidating or in a downtrend. Monitor for potential reversal signals.`
                : `Strong sell signals with only ${buySignals} out of ${totalSignals} indicators positive. The stock shows weak momentum and bearish technical setup.`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}