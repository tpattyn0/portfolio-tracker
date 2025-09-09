// app/(dashboard)/dashboard/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PortfolioChart } from "@/components/portfolio-chart";
import { PositionsTable } from "@/components/positions-table";
import { PortfolioInsights } from "@/components/portfolio-insights"; // Add this import
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import Link from "next/link";
import { usePriceSync } from "@/hooks/use-price-sync";

export default function DashboardPage() {
  // Add price sync
  usePriceSync();
  
  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const hasPositions = portfolio?.positions?.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-600 mt-1">
            Track your investments and monitor performance
          </p>
        </div>
        <Link href="/portfolio/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(portfolio?.totalValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasPositions ? "Current market value" : "Start investing today"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Change</CardTitle>
            {portfolio?.dayChange >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className={cn(
                portfolio?.dayChange >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {portfolio?.dayChange >= 0 && "+"}
                {formatCurrency(portfolio?.dayChange || 0)}
              </span>
            </div>
            <p className={cn(
              "text-xs",
              portfolio?.dayChangePercent >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(portfolio?.dayChangePercent || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            {portfolio?.totalReturn >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className={cn(
                portfolio?.totalReturn >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {portfolio?.totalReturn >= 0 && "+"}
                {formatCurrency(portfolio?.totalReturn || 0)}
              </span>
            </div>
            <p className={cn(
              "text-xs",
              portfolio?.totalReturnPercent >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(portfolio?.totalReturnPercent || 0)} all time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Portfolio Insights - Only show if user has positions */}
      {hasPositions && (
        <PortfolioInsights />
      )}

      {/* Performance Chart */}
      {hasPositions && (
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioChart positions={portfolio?.positions} />
          </CardContent>
        </Card>
      )}

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPositions ? (
            <PositionsTable positions={portfolio.positions} />
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <TrendingUp className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No positions yet</h3>
              <p className="text-gray-600 mb-4">
                Start building your portfolio by adding your first position
              </p>
              <Link href="/portfolio/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Position
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32 mb-1" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add skeleton for Portfolio Insights */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}