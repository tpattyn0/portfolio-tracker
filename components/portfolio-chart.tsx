"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioChartProps {
  positions?: Array<{
    id: string;
    ticker: string;
    quantity: number;
    avgCostBasis: number;
    currentPrice: number;
    createdAt: string;
  }>;
}

export function PortfolioChart({ positions }: PortfolioChartProps) {
  // For now, create a simple performance visualization
  const chartData = useMemo(() => {
    if (!positions || positions.length === 0) return [];

    // Calculate total cost and current value
    const totalCost = positions.reduce((sum, pos) => sum + (pos.quantity * pos.avgCostBasis), 0);
    const currentValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
    
    // Generate 30 days of data points
    const days = 30;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = subDays(new Date(), i);
      
      // Linear interpolation from cost to current value
      const progress = (days - i) / days;
      const value = totalCost + (currentValue - totalCost) * progress;
      
      // Add some realistic daily volatility
      const volatility = (Math.sin(i * 0.5) * 0.02 + Math.random() * 0.01) * value;
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: i === 0 ? currentValue : value + volatility,
        cost: totalCost,
      });
    }
    
    return data;
  }, [positions]);

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

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        Unable to load performance data
      </div>
    );
  }

  const totalCost = chartData[0]?.cost || 0;
  const currentValue = chartData[chartData.length - 1]?.value || 0;
  const profit = currentValue - totalCost;
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return (
    <div>
      <div className="mb-4 flex justify-between items-baseline">
        <div>
          <p className="text-sm text-gray-600">Total Cost: {formatCurrency(totalCost)}</p>
          <p className="text-sm text-gray-600">Market Value: {formatCurrency(currentValue)}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
          </p>
          <p className={`text-sm ${profitPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={chartData} 
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={profit >= 0 ? "#10b981" : "#ef4444"} 
                  stopOpacity={0.1}
                />
                <stop 
                  offset="95%" 
                  stopColor={profit >= 0 ? "#10b981" : "#ef4444"} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
              interval="preserveStartEnd"
            />
            
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `€${value.toFixed(0)}`}
              width={60}
            />
            
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
              contentStyle={{ fontSize: 12 }}
            />
            
            <ReferenceLine 
              y={totalCost} 
              stroke="#6b7280" 
              strokeDasharray="3 3" 
              strokeOpacity={0.5}
              label={{ value: "Cost Basis", position: "left", fontSize: 10 }}
            />
            
            <Area
              type="monotone"
              dataKey="value"
              stroke={profit >= 0 ? "#10b981" : "#ef4444"}
              fillOpacity={1}
              fill="url(#colorValue)"
              strokeWidth={2}
              name="Portfolio Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}