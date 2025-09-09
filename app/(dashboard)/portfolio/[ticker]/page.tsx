"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Loader2,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { PriceChart } from "@/components/price-chart";
import { TransactionHistory } from "@/components/transaction-history";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { NewsFeed } from "@/components/news-feed";
import { SentimentScore } from "@/components/sentiment-score";  // Add this import
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  
  // Fix hydration by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const ticker = params.ticker as string;

  // Fetch position data
  const { data: position, isLoading: positionLoading } = useQuery({
    queryKey: ["position", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/positions/${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch position");
      return res.json();
    },
    enabled: mounted && !!ticker,
  });

  // Fetch live market data
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/market/quote/${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    enabled: mounted && !!ticker,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch news data for sentiment analysis
  const { 
    data: newsArticles, 
    isLoading: newsLoading,
    refetch: refetchNews 
  } = useQuery({
    queryKey: ["news", ticker, position?.name],
    queryFn: async () => {
      // Pass company name to improve relevance
      const params = new URLSearchParams({
        analyze: 'true',
        limit: '20'
      });
      if (position?.name) {
        params.append('name', position.name);
      }
      
      const res = await fetch(`/api/news/${ticker}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    enabled: mounted && !!ticker && !!position,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Delete position mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portfolio/positions/${ticker}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete position");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      router.push("/dashboard");
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this position?")) {
      deleteMutation.mutate();
    }
  };

  const handleRefreshNews = async () => {
    setIsRefreshingNews(true);
    await refetchNews();
    setTimeout(() => setIsRefreshingNews(false), 1000);
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  if (positionLoading || quoteLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Position not found</h2>
        <p className="mt-2 text-gray-600">The position you're looking for doesn't exist.</p>
        <Link href="/dashboard">
          <Button className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate real-time metrics with fallbacks
  const currentPrice = quote?.price || position.currentPrice || 0;
  const marketValue = position.quantity * currentPrice;
  const totalCost = position.quantity * position.avgCostBasis;
  const unrealizedPL = marketValue - totalCost;
  const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
  const dayChange = quote ? (quote.change || 0) * position.quantity : 0;
  const dayChangePercent = quote?.changePercent ? quote.changePercent * 100 : 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        
        {/* Title and actions */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{position.ticker}</h1>
            <p className="text-gray-600">{position.name}</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Buy More
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(marketValue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(position.quantity)} shares @ {formatCurrency(currentPrice)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            {unrealizedPL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              unrealizedPL >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {unrealizedPL >= 0 && "+"}{formatCurrency(unrealizedPL)}
            </div>
            <p className={cn(
              "text-xs",
              unrealizedPLPercent >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(unrealizedPLPercent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Change</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              dayChange >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {dayChange >= 0 && "+"}{formatCurrency(dayChange)}
            </div>
            <p className={cn(
              "text-xs",
              dayChangePercent >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(dayChangePercent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(position.avgCostBasis)}
            </div>
            <p className="text-xs text-muted-foreground">
              First buy: {new Date(position.firstBuyDate || position.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="technical">Technical Analysis</TabsTrigger>
          <TabsTrigger value="fundamental">Fundamental Analysis</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <PriceChart symbol={position.ticker} name={position.name} />
        </TabsContent>

        <TabsContent value="technical" className="space-y-4">
          <TechnicalAnalysis symbol={position.ticker} />
        </TabsContent>

        <TabsContent value="fundamental" className="space-y-4">
          <FundamentalAnalysis symbol={position.ticker} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <TransactionHistory positionId={position.id} />
        </TabsContent>

        <TabsContent value="news" className="space-y-6">
          {/* Sentiment Score Overview */}
          {newsArticles && newsArticles.length > 0 && (
            <SentimentScore 
              articles={newsArticles} 
              symbol={position.ticker} 
            />
          )}
          
          {/* News Feed with refresh button */}
          <div className="space-y-4">
            {/* Optional: Add a refresh button for news */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshNews}
                disabled={isRefreshingNews || newsLoading}
              >
                <RefreshCw className={cn(
                  "h-4 w-4 mr-2",
                  isRefreshingNews && "animate-spin"
                )} />
                Refresh News
              </Button>
            </div>
            
            {/* News Feed Component */}
            {newsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <NewsFeed 
                symbol={position.ticker}
                companyName={position.name}
                articles={newsArticles}  // Pass articles to avoid double fetching
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}