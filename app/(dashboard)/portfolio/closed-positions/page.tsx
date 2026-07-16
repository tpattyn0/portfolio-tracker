"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TickerFilter, TickerOption } from "@/components/closed-positions/ticker-filter";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Percent,
  ArrowUpDown,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface ClosedPosition {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  firstBuyDate: string;
  closeDate: string;
  holdingDays: number;
  totalSharesSold: number;
  avgCostBasis: number;
  avgSellPrice: number;
  realizedPL: number;
  realizedPLPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface Aggregates {
  totalClosedPositions: number;
  totalRealizedPL: number;
  avgHoldingDays: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
}

export default function ClosedPositionsPage() {
  const [sortBy, setSortBy] = useState("closeDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "winners" | "losers">("all");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  // Fetch closed positions
  const { data, isLoading, error } = useQuery({
    queryKey: ["closed-positions", sortBy, sortOrder, outcomeFilter, selectedTickers],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(outcomeFilter !== "all" && { outcome: outcomeFilter }),
        ...(selectedTickers.length > 0 && { tickers: selectedTickers.join(',') }),
      });
      
      const res = await fetch(`/api/portfolio/closed-positions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch closed positions");
      return res.json() as Promise<{
        positions: ClosedPosition[];
        aggregates: Aggregates;
        tickerOptions: TickerOption[];
      }>;
    },
  });

  const { tickerOptions = [] } = data || {};

  // Handle ticker filter change
  const handleTickerFilterChange = (values: string[]) => {
    setSelectedTickers(values);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleExport = async () => {
    if (!data?.positions) return;

    const csv = [
      // Headers
      ["Ticker", "Name", "First Buy Date", "Close Date", "Holding Days", "Shares Sold", "Avg Cost", "Avg Sell Price", "Realized P/L", "Realized P/L %", "Total Return", "Total Return %"].join(","),
      // Data rows
      ...data.positions.map(p => [
        p.ticker,
        `"${p.name}"`,
        new Date(p.firstBuyDate).toLocaleDateString(),
        new Date(p.closeDate).toLocaleDateString(),
        p.holdingDays,
        p.totalSharesSold,
        p.avgCostBasis.toFixed(2),
        p.avgSellPrice.toFixed(2),
        p.realizedPL.toFixed(2),
        p.realizedPLPercent.toFixed(2),
        p.totalReturn.toFixed(2),
        p.totalReturnPercent.toFixed(2),
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closed-positions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Define default values
  const defaultAggregates: Aggregates = {
    totalClosedPositions: 0,
    totalRealizedPL: 0,
    avgHoldingDays: 0,
    winRate: 0,
    avgReturn: 0,
    medianReturn: 0,
  };

  // Set display values
  const displayAggregates = data?.aggregates || defaultAggregates;
  const displayPositions = data?.positions || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading closed positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading closed positions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Closed Positions</h1>
          <p className="text-gray-600 mt-1">
            Track and analyze your completed trades
          </p>
        </div>
        <Button onClick={handleExport} disabled={displayPositions.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Aggregates */}
      {displayPositions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(displayAggregates.totalClosedPositions)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Realized P/L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                displayAggregates.totalRealizedPL >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(displayAggregates.totalRealizedPL)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercent(displayAggregates.winRate)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Holding Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(displayAggregates.avgHoldingDays)} days
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Return</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                displayAggregates.winRate >= 0.5 ? "text-green-600" : "text-red-600"
              )}>
                {formatPercent(displayAggregates.winRate)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Median Return</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                displayAggregates.medianReturn >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatPercent(displayAggregates.medianReturn)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-full">
            <TickerFilter
              options={tickerOptions}
              selectedValues={selectedTickers}
              onSelect={handleTickerFilterChange}
              placeholder="Filter by ticker or name..."
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={outcomeFilter}
              onValueChange={(value: "all" | "winners" | "losers") =>
                setOutcomeFilter(value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                <SelectItem value="winners">Winning Trades</SelectItem>
                <SelectItem value="losers">Losing Trades</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      {displayPositions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600 mb-4">
              {selectedTickers.length > 0 
                ? "No closed positions match the selected filters"
                : "No closed positions yet"
              }
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline">View Portfolio</Button>
              </Link>
              <Link href="/research">
                <Button>Research Stocks</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort("holdingDays")}
                    >
                      <div className="flex items-center">
                        Holding Period
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Shares Sold</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>Avg Sell Price</TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort("realizedPL")}
                    >
                      <div className="flex items-center">
                        Realized P/L
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort("realizedPLPercent")}
                    >
                      <div className="flex items-center">
                        Return %
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort("closeDate")}
                    >
                      <div className="flex items-center">
                        Close Date
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayPositions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/research/${position.ticker}`}
                          className="hover:underline"
                        >
                          {position.ticker}
                        </Link>
                      </TableCell>
                      <TableCell>{position.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{position.holdingDays} days</div>
                          <div className="text-gray-500 text-xs">
                            {new Date(position.firstBuyDate).toLocaleDateString()} → {new Date(position.closeDate).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(position.totalSharesSold)}</TableCell>
                      <TableCell>{formatCurrency(position.avgCostBasis)}</TableCell>
                      <TableCell>{formatCurrency(position.avgSellPrice)}</TableCell>
                      <TableCell>
                        <div className={cn(
                          "font-medium",
                          position.realizedPL >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {formatCurrency(position.realizedPL)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={position.realizedPLPercent >= 0 ? "default" : "destructive"}
                        >
                          {position.realizedPLPercent >= 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {formatPercent(position.realizedPLPercent)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(position.closeDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}