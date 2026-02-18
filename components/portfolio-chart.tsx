"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils/format";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "FROM_START";

interface PortfolioChartProps {
  positions?: Array<{ id: string; ticker: string; name: string; quantity: number }>;
  baseCurrency?: string;
  exchangeRatesUsed?: Array<{ from: string; to: string; rate: number }>;
  totalValue?: number;
  totalCost?: number;
}

const ranges: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "10Y", value: "10Y" },
  { label: "From Start", value: "FROM_START" },
];

export function PortfolioChart({ positions, baseCurrency = 'EUR', exchangeRatesUsed, totalValue, totalCost }: PortfolioChartProps) {
  const [range, setRange] = useState<Range>("1M");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio-performance", range, baseCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/performance?range=${range}&baseCurrency=${baseCurrency}`);
      if (!res.ok) throw new Error("Failed to load performance");
      return res.json();
    },
  });

  if (!positions || positions.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">No portfolio data to display</p>
          <p className="text-xs mt-1">Add positions to see your performance chart</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (isError || !data?.series) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        Unable to load performance data
      </div>
    );
  }

  const raw = data.series as Array<{ date: string; value: number }>;
  const chartData = raw.map(p => ({ ts: new Date(p.date).getTime(), value: p.value }));

  // Use actual totalValue if provided (more accurate than chart end value)
  const endVal = totalValue !== undefined ? totalValue : (chartData[chartData.length - 1]?.value || 0);
  const costBasis = totalCost !== undefined ? totalCost : (chartData[0]?.value || 0);

  // Calculate return based on cost basis
  const change = endVal - costBasis;
  const changePct = costBasis > 0 ? (change / costBasis) * 100 : 0;

  const isIntraday = range === "1D" || range === "1W";

  // Dynamic Y-axis domain with padding
  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = Math.max(1, maxVal - minVal);
  const pad = span * 0.1; // 10% padding
  const yMin = Math.max(0, minVal - pad); // Don't go below 0
  const yMax = maxVal + pad;

  return (
    <div>
      {/* Exchange Rates - Only show if multi-currency */}
      {exchangeRatesUsed && exchangeRatesUsed.length > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          <span className="font-medium">Rates:</span>
          {" "}
          {exchangeRatesUsed.map((rate, idx) => (
            <span key={`${rate.from}-${rate.to}`}>
              {idx > 0 && ", "}
              <span className="font-mono">{rate.from}/{rate.to} {rate.rate.toFixed(4)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mb-4">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="flex flex-wrap">
            {ranges.map(r => (
              <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.1} />
                <stop offset="95%" stopColor={change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={[chartData[0]?.ts || 'dataMin', chartData[chartData.length - 1]?.ts || 'dataMax']}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                const d = new Date(Number(value));
                if (isIntraday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                // Monthly/yearly ranges
                if (["5Y", "10Y", "FROM_START"].includes(range)) return format(d, 'MMM yy');
                return format(d, 'MMM d');
              }}
              tickCount={isIntraday ? 8 : 6}
              minTickGap={12}
              allowDuplicatedCategory={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(val) => formatCompactCurrency(Number(val), baseCurrency)}
              width={60}
              domain={[yMin, yMax]}
              allowDecimals
            />
            <Tooltip
              formatter={(val: number) => formatCurrency(val, baseCurrency)}
              labelFormatter={(label) => {
                const d = new Date(Number(label));
                return isIntraday ? d.toLocaleString() : format(d, 'MMM d, yyyy');
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Area type="monotone" dataKey="value" stroke={change >= 0 ? "#10b981" : "#ef4444"} fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} name="Portfolio Value" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}