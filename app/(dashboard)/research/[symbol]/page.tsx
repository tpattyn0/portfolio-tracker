"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { FundamentalAnalysis } from "@/components/fundamental-analysis";
import { IntrinsicValue } from "@/components/intrinsic-value";
import { Overview } from "@/components/overview";
import { AnalystRatings } from "@/components/analyst-ratings";
import { NewsFeed } from "@/components/news-feed";
import { AddToWishlistModal } from "@/components/add-to-wishlist-modal";
import { formatCurrency, formatPercent, formatCompactCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";


export default function ResearchStockPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [quote, setQuote] = useState<any>(null);
  const [fundamentals, setFundamentals] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (symbol) {
      fetchStockData();
    }
  }, [symbol]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      // Fetch quote data
      const quoteRes = await fetch(`/api/market/quote/${symbol}`);
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        setQuote(quoteData);
      }

      // Fetch fundamental data
      const fundamentalRes = await fetch(`/api/market/fundamentals/${symbol}`);
      if (fundamentalRes.ok) {
        const fundamentalData = await fundamentalRes.json();
        setFundamentals(fundamentalData);
      }
    } catch (error) {
      console.error("Error fetching stock data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/research"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Research
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{symbol}</h1>
            {quote && <p className="text-gray-600">{quote.name}</p>}
          </div>
          <div className="flex gap-2">
            <AddToWishlistModal
              defaultTicker={symbol}
              trigger={
                <Button variant="outline" size="sm">
                  <Star className="h-4 w-4 mr-1" />
                  Add to Wishlist
                </Button>
              }
            />
            <Link href={`/portfolio/add?ticker=${symbol}`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add to Portfolio
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Price Summary */}
      {quote && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-gray-600">Current Price</p>
                <p className="text-2xl font-bold">{formatCurrency(quote.price, quote.currency)}</p>
                <p className={cn(
                  "text-sm",
                  quote.change >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {quote.change >= 0 && "+"}{formatCurrency(quote.change, quote.currency)} ({formatPercent(quote.changePercent * 100)})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Day Range</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(quote.dayLow, quote.currency)} - {formatCurrency(quote.dayHigh, quote.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">52 Week Range</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(quote.yearLow, quote.currency)} - {formatCurrency(quote.yearHigh, quote.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Market Cap</p>
                <p className="text-lg font-semibold">
                  {quote.marketCap ? formatCompactCurrency(quote.marketCap, quote.currency) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technical">Technical Analysis</TabsTrigger>
          <TabsTrigger value="fundamental">Fundamental Analysis</TabsTrigger>
          <TabsTrigger value="analyst">Analyst Ratings</TabsTrigger>
          <TabsTrigger value="intrinsic">Intrinsic Value</TabsTrigger>
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {quote && (
            <Overview 
              symbol={symbol}
              name={quote.name}
              currentPrice={quote.price}
              context="wishlist"
              currency={quote.currency}
            />
          )}
        </TabsContent>

        <TabsContent value="technical" className="space-y-4">
          <TechnicalAnalysis symbol={symbol} currency={quote?.currency} />
        </TabsContent>

        <TabsContent value="fundamental" className="space-y-4">
          <FundamentalAnalysis symbol={symbol} currency={quote?.currency} />
        </TabsContent>

        <TabsContent value="analyst" className="space-y-4">
          <AnalystRatings symbol={symbol} currency={quote?.currency} />
        </TabsContent>

        <TabsContent value="intrinsic" className="space-y-4">
            {quote && <IntrinsicValue symbol={symbol} currentPrice={quote.price} currency={quote.currency} />}
            
            {/* Additional Valuation Metrics */}
            {fundamentals && (
            <Card>
                <CardHeader>
                <CardTitle>Comparative Valuation Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                    <p className="text-sm text-gray-600">P/E Ratio</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.peRatio?.toFixed(2) || "—"}
                    </p>
                    {fundamentals.industryAvgPE && (
                        <p className="text-xs text-gray-500">
                        Industry Avg: {fundamentals.industryAvgPE.toFixed(2)}
                        </p>
                    )}
                    </div>
                    <div>
                    <p className="text-sm text-gray-600">PEG Ratio</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.pegRatio?.toFixed(2) || "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                        {fundamentals.pegRatio && fundamentals.pegRatio < 1 
                        ? "Potentially undervalued" 
                        : fundamentals.pegRatio && fundamentals.pegRatio > 2 
                        ? "Potentially overvalued"
                        : "Fair valued"}
                    </p>
                    </div>
                    <div>
                    <p className="text-sm text-gray-600">P/B Ratio</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.pbRatio?.toFixed(2) || "—"}
                    </p>
                    {fundamentals.industryAvgPB && (
                        <p className="text-xs text-gray-500">
                        Industry Avg: {fundamentals.industryAvgPB.toFixed(2)}
                        </p>
                    )}
                    </div>
                    <div>
                    <p className="text-sm text-gray-600">P/S Ratio</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.psRatio?.toFixed(2) || "—"}
                    </p>
                    </div>
                    <div>
                    <p className="text-sm text-gray-600">EV/EBITDA</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.evToEbitda?.toFixed(2) || "—"}
                    </p>
                    </div>
                    <div>
                    <p className="text-sm text-gray-600">Price to FCF</p>
                    <p className="text-xl font-semibold">
                        {fundamentals.priceToFCF?.toFixed(2) || "—"}
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>
            )}
        </TabsContent>


        <TabsContent value="news" className="space-y-4">
          <NewsFeed symbol={symbol} companyName={quote?.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}