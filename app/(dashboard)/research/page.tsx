"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Star, Activity } from "lucide-react";
import { StockSearch } from "@/components/stock-search";

export default function ResearchPage() {
  const router = useRouter();

  const popularStocks = [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "MSFT", name: "Microsoft Corporation" },
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "AMZN", name: "Amazon.com Inc." },
    { symbol: "NVDA", name: "NVIDIA Corporation" },
    { symbol: "TSLA", name: "Tesla Inc." },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Stock Research</h1>
        <p className="text-gray-600 mt-1">
          Research stocks, analyze fundamentals, and calculate intrinsic value
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <StockSearch onSelect={(stock) => router.push(`/research/${stock.symbol}`)} />
        </CardContent>
      </Card>

      {/* Popular Stocks */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {popularStocks.map((stock) => (
              <Button
                key={stock.symbol}
                variant="outline"
                className="justify-start"
                onClick={() => router.push(`/research/${stock.symbol}`)}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <div className="font-semibold">{stock.symbol}</div>
                  <div className="text-sm text-gray-600">{stock.name}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Technical Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              View technical indicators, moving averages, and RSI signals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Fundamental Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Analyze P/E ratios, margins, growth rates, and financial health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-5 w-5" />
              Intrinsic Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Calculate fair value using DCF, Graham Number, and PEG methods
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}