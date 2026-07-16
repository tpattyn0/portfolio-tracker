"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Users, BarChart4, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

export interface AnalystRatingsData {
  targetPrice: number | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  averageRating: number | null;
  lastUpdated: string;
  score: number;
  scoreInterpretation: string;
}

interface AnalystRatingsProps {
  symbol: string;
  currentPrice?: number;
  initialData?: AnalystRatingsData;
  currency?: string;
}

export function AnalystRatings({ symbol, currentPrice, initialData, currency }: AnalystRatingsProps) {
  const [ratings, setRatings] = useState<AnalystRatingsData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRatings = async () => {
      if (initialData) return; // Use initialData if provided
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/market/analyst-ratings/${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch analyst ratings: ${response.statusText}`);
        }
        const data = await response.json();
        setRatings(data);
      } catch (err) {
        console.error('Error fetching analyst ratings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analyst ratings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRatings();
  }, [symbol, initialData]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart4 className="mr-2 h-5 w-5" />
            Analyst Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !ratings) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart4 className="mr-2 h-5 w-5" />
            Analyst Ratings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Failed to load analyst ratings'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  const ratingToPercent = (count: number) => {
    if (ratings?.totalAnalysts === 0) return 0;
    return ((count || 0) / (ratings?.totalAnalysts || 1)) * 100;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 7) return "bg-green-500";
    if (rating >= 5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return "Strong Sell";
    if (rating >= 3.5) return "Sell";
    if (rating >= 2.5) return "Hold";
    if (rating >= 1.5) return "Buy";
    return "Strong Buy";
  };


  // Calculate recommendation percentages
  const totalRatings = ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell;
  const getPercentage = (count: number) => totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0;

  // Calculate price difference if current price is available
  let priceDifference = null;
  if (currentPrice && ratings.targetPrice) {
    const diff = ((ratings.targetPrice - currentPrice) / currentPrice) * 100;
    priceDifference = {
      value: diff,
      isPositive: diff >= 0,
      formatted: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
      absolute: Math.abs(diff).toFixed(1) + '%'
    };
  }
  
  const averageRating = ratings?.averageRating || 3; // Default to Hold if no rating
  const consensusRating = getRatingLabel(averageRating);
  const scorePercentage = (ratings.score / 10) * 100; // Convert 0-10 score to percentage

  return (
    <div className="space-y-6">
      {/* Top Row - Three Equal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Analyst Coverage Card */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Analysts Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-end">
            <div className="w-full">
              <div className="flex items-baseline">
                <span className="text-3xl font-bold">{ratings.totalAnalysts}</span>
                <span className="ml-2 text-sm text-muted-foreground">analysts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consensus Rating Card */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consensus</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-between">
            <div className="text-3xl font-bold mb-2">{consensusRating}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Analyst Score</span>
                <span>{ratings.score.toFixed(1)}/10</span>
              </div>
              <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    scorePercentage > 70 ? 'bg-green-500' :
                    scorePercentage > 30 ? 'bg-yellow-400' : 'bg-red-500'
                  )}
                  style={{ width: `${scorePercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Updated {new Date(ratings.lastUpdated).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Target Price Card */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Target Price
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-between">
            <div className="text-3xl font-bold">
              {ratings.targetPrice ? formatCurrency(ratings.targetPrice, currency) : 'N/A'}
            </div>
            {currentPrice && priceDifference && (
              <p className={cn(
                'text-sm mt-2',
                priceDifference.isPositive ? 'text-green-500' : 'text-red-500'
              )}>
                {priceDifference.formatted} {priceDifference.isPositive ? '▲' : '▼'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analyst Ratings Table */}
      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <BarChart4 className="mr-2 h-5 w-5" />
              Analyst Ratings
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Consolidated Rating Bar */}
            <div className="space-y-3">
              <div className="h-8 w-full bg-gray-200 rounded-full overflow-hidden flex">
                {ratings.strongBuy > 0 && (
                  <div
                    className="h-full bg-green-500 relative group flex items-center justify-center"
                    style={{ width: `${ratingToPercent(ratings.strongBuy)}%` }}
                  >
                    <span className="text-xs font-medium text-white px-1 truncate">
                      {ratings.strongBuy}
                    </span>
                  </div>
                )}
                {ratings.buy > 0 && (
                  <div
                    className="h-full bg-green-400 relative group flex items-center justify-center"
                    style={{ width: `${ratingToPercent(ratings.buy)}%` }}
                  >
                    <span className="text-xs font-medium text-white px-1 truncate">
                      {ratings.buy}
                    </span>
                  </div>
                )}
                {ratings.hold > 0 && (
                  <div
                    className="h-full bg-yellow-400 relative group flex items-center justify-center"
                    style={{ width: `${ratingToPercent(ratings.hold)}%` }}
                  >
                    <span className="text-xs font-medium text-gray-800 px-1 truncate">
                      {ratings.hold}
                    </span>
                  </div>
                )}
                {ratings.sell > 0 && (
                  <div
                    className="h-full bg-orange-500 relative group flex items-center justify-center"
                    style={{ width: `${ratingToPercent(ratings.sell)}%` }}
                  >
                    <span className="text-xs font-medium text-white px-1 truncate">
                      {ratings.sell}
                    </span>
                  </div>
                )}
                {ratings.strongSell > 0 && (
                  <div
                    className="h-full bg-red-500 relative group flex items-center justify-center"
                    style={{ width: `${ratingToPercent(ratings.strongSell)}%` }}
                  >
                    <span className="text-xs font-medium text-white px-1 truncate">
                      {ratings.strongSell}
                    </span>
                  </div>
                )}
              </div>
<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div>
                  <span>Strong Buy</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-400 mr-1.5"></div>
                  <span>Buy</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 mr-1.5"></div>
                  <span>Hold</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></div>
                  <span>Sell</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-1.5"></div>
                  <span>Strong Sell</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
