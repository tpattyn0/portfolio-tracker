"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge"; 
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
  RefreshCw,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { Overview } from "@/components/overview";
import { TransactionHistory } from "@/components/transaction-history";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { IntrinsicValue } from "@/components/intrinsic-value";
import { AnalystRatings } from "@/components/analyst-ratings";
import { NewsFeed } from "@/components/news-feed";
import { SentimentScore } from "@/components/sentiment-score";
import { SellPositionModal } from "@/components/sell-position-modal";
import { BuyMoreModal } from "@/components/buy-more-modal";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";



export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isBuyMoreModalOpen, setIsBuyMoreModalOpen] = useState(false);
  
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
    if (confirm("Are you sure you want to delete this position? This will remove all transaction history.")) {
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

  // Get base currency from position (converted by API)
  const baseCurrency = position.baseCurrency || 'EUR';

  // Calculate real-time metrics with fallbacks
  // Note: quote prices need to be converted if position is in different currency
  let currentPrice = position.currentPrice || 0;
  if (quote?.price) {
    // Apply conversion rate to quote price if available
    currentPrice = quote.price * (position.conversionRate || 1);
  }

  const marketValue = position.quantity * currentPrice;
  const totalCost = position.quantity * position.avgCostBasis;
  const unrealizedPL = marketValue - totalCost;
  const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
  const dayChange = quote ? (quote.change || 0) * position.quantity * (position.conversionRate || 1) : 0;
  const dayChangePercent = quote?.changePercent ? quote.changePercent * 100 : 0;
  const totalPL = unrealizedPL + (position.realizedPL || 0);
  
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
            {position.quantity === 0 && (
              <Badge variant="secondary" className="mt-2">Position Closed</Badge>
            )}
          </div>
          <div className="flex space-x-2">
            {position.quantity > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsBuyMoreModalOpen(true)}
                  className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Buy More
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsSellModalOpen(true)}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  Sell
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" disabled>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(marketValue, baseCurrency)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(position.quantity)} shares @ {formatCurrency(currentPrice, baseCurrency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized P/L</CardTitle>
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
              {unrealizedPL >= 0 && "+"}{formatCurrency(unrealizedPL, baseCurrency)}
            </div>
            <p className={cn(
              "text-xs",
              unrealizedPLPercent >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(unrealizedPLPercent)}
            </p>
          </CardContent>
        </Card>

        {position.realizedPL !== undefined && position.realizedPL !== 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Realized P/L</CardTitle>
              {position.realizedPL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                position.realizedPL >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {position.realizedPL >= 0 && "+"}{formatCurrency(position.realizedPL, baseCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                From previous sales
              </p>
            </CardContent>
          </Card>
        )}

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
              {dayChange >= 0 && "+"}{formatCurrency(dayChange, baseCurrency)}
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
              {formatCurrency(position.avgCostBasis, baseCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              First buy: {new Date(position.firstBuyDate || position.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technical">Technical Analysis</TabsTrigger>
          <TabsTrigger value="fundamental">Fundamental Analysis</TabsTrigger>
          <TabsTrigger value="analyst">Analyst Ratings</TabsTrigger>
          <TabsTrigger value="intrinsic">Intrinsic Value</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ComponentErrorBoundary name="Overview">
            <Overview
              symbol={position.ticker}
              name={position.name}
              currentPrice={currentPrice}
            />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="technical" className="space-y-4">
          <ComponentErrorBoundary name="Technical Analysis">
            <TechnicalAnalysis symbol={position.ticker} />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="fundamental" className="space-y-4">
          <ComponentErrorBoundary name="Fundamental Analysis">
            <FundamentalAnalysis symbol={position.ticker} />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="analyst" className="space-y-4">
          <ComponentErrorBoundary name="Analyst Ratings">
            <AnalystRatings
              symbol={position.ticker}
              currentPrice={currentPrice}
            />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="intrinsic" className="space-y-4">
          <ComponentErrorBoundary name="Intrinsic Value">
            <IntrinsicValue
              symbol={position.ticker}
              currentPrice={currentPrice}
            />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <ComponentErrorBoundary name="Transaction History">
            <TransactionHistory positionId={position.id} baseCurrency={baseCurrency} />
          </ComponentErrorBoundary>
        </TabsContent>

        <TabsContent value="news" className="space-y-6">
          <ComponentErrorBoundary name="News & Sentiment">
            {/* Sentiment Score Overview */}
            {newsArticles && newsArticles.length > 0 && (
              <SentimentScore
                articles={newsArticles}
                symbol={position.ticker}
              />
            )}

            {/* News Feed with refresh button */}
            <div className="space-y-4">
              {/* Add a refresh button for news */}
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
                  articles={newsArticles}
                />
              )}
            </div>
          </ComponentErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {position && position.quantity > 0 && (
        <>
          <SellPositionModal
            isOpen={isSellModalOpen}
            onClose={() => setIsSellModalOpen(false)}
            position={{
              id: position.id,
              ticker: position.ticker,
              name: position.name,
              quantity: position.quantity,
              avgCostBasis: position.avgCostBasis,
              currentPrice: currentPrice,
              marketValue: marketValue,
            }}
            quote={quote}
          />

          <BuyMoreModal
            isOpen={isBuyMoreModalOpen}
            onClose={() => setIsBuyMoreModalOpen(false)}
            position={{
              ticker: position.ticker,
              name: position.name,
              quantity: position.quantity,
              avgCostBasis: position.avgCostBasis,
              currentPrice: currentPrice,
            }}
            quote={quote}
          />
        </>
      )}
    </div>
  );
}