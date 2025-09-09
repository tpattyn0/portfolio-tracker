// components/portfolio-insights.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  Activity,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PortfolioInsights() {
  const { data: insights, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["portfolio-insights"],
    queryFn: async () => {
      const res = await fetch("/api/insights/portfolio");
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  if (isLoading) {
    return <PortfolioInsightsSkeleton />;
  }

  if (!insights) {
    return null;
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.2) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (sentiment < -0.2) return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Activity className="h-5 w-5 text-gray-500" />;
  };

  const getSentimentText = (sentiment: number) => {
    if (sentiment > 0.2) return "Positive";
    if (sentiment < -0.2) return "Negative";
    return "Neutral";
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.2) return "text-green-600";
    if (sentiment < -0.2) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-4">
      {/* Market Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Brain className="mr-2 h-5 w-5" />
              AI Portfolio Insights
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {new Date(insights.createdAt).toLocaleDateString()}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className={cn(
                  "h-4 w-4",
                  isRefetching && "animate-spin"
                )} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Market Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Market Sentiment</h3>
              <div className="flex items-center gap-2">
                {getSentimentIcon(insights.marketSentiment)}
                <span className={cn(
                  "font-medium",
                  getSentimentColor(insights.marketSentiment)
                )}>
                  {getSentimentText(insights.marketSentiment)}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">{insights.marketSummary}</p>
          </div>

          {/* Portfolio Impact */}
          <Alert>
            <AlertDescription>{insights.portfolioImpact}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Risks and Opportunities Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Risks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              Top Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(insights.topRisks as string[] || []).map((risk, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  <span className="text-sm">{risk}</span>
                </li>
              ))}
              {(!insights.topRisks || insights.topRisks.length === 0) && (
                <li className="text-sm text-gray-500">No significant risks identified</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Lightbulb className="mr-2 h-4 w-4 text-blue-500" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(insights.opportunities as string[] || []).map((opportunity, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span className="text-sm">{opportunity}</span>
                </li>
              ))}
              {(!insights.opportunities || insights.opportunities.length === 0) && (
                <li className="text-sm text-gray-500">No specific opportunities identified</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Target className="mr-2 h-4 w-4 text-green-500" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(insights.recommendations as string[] || []).map((recommendation, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-500 mr-2 font-bold">{index + 1}.</span>
                <span className="text-sm">{recommendation}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PortfolioInsightsSkeleton() {
  return (
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
  );
}