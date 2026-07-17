"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  AlertCircle,
  Clock,
  Brain,
  RefreshCw,
  Building2,
  Search,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NewsArticle {
  id: string;
  title: string;
  summary?: string | null;
  url: string;
  source: string;
  publishedAt: string | Date;
  imageUrl?: string | null;
  sentiment?: number | null;
  sentimentLabel?: string | null;
  confidence?: number | null;
  impact?: string | null;
  aiSummary?: string | null;
  relevanceScore?: number | null;
}

interface NewsFeedProps {
  symbol: string;
  companyName?: string;
  articles?: NewsArticle[];
}

export function NewsFeed({ symbol, companyName, articles: propArticles }: NewsFeedProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const [showLowRelevance, setShowLowRelevance] = useState(false);
  
  // Only fetch if articles not provided as props
  const { data: fetchedArticles, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["news", symbol, companyName],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        analyze: 'true',
        limit: '20'
      });
      if (companyName) {
        params.append('name', companyName);
      }
      
      const res = await fetch(`/api/news/${symbol}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json() as Promise<NewsArticle[]>;
    },
    enabled: !propArticles,
    refetchInterval: 5 * 60 * 1000,
  });
  
  // Use prop articles if provided, otherwise use fetched
  const allNews = propArticles || fetchedArticles || [];
  
  // Filter out very low relevance articles unless explicitly shown
  const news = showLowRelevance 
    ? allNews 
    : allNews.filter(article => (article.relevanceScore || 1) >= 0.5);
  
  const lowRelevanceCount = allNews.filter(article => 
    article.relevanceScore && article.relevanceScore < 0.5
  ).length;
  
  const analyzeSentiment = async () => {
    setIsAnalyzing(true);
    try {
      const params = new URLSearchParams({ 
        analyze: 'true',
        forceAnalyze: 'true'
      });
      if (companyName) {
        params.append('name', companyName);
      }
      
      await fetch(`/api/news/${symbol}?${params}`);
      await refetch();
    } catch (error) {
      console.error("Failed to analyze sentiment:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Filter news by sentiment
  const filteredNews = news.filter(article => {
    if (selectedTab === "all") return true;
    if (selectedTab === "positive") return (article.sentiment || 0) > 0.2;
    if (selectedTab === "negative") return (article.sentiment || 0) < -0.2;
    if (selectedTab === "neutral") {
      const sentiment = article.sentiment || 0;
      return sentiment >= -0.2 && sentiment <= 0.2;
    }
    return true;
  });
  
  const sentimentCounts = {
    all: news.length,
    positive: news.filter(a => (a.sentiment || 0) > 0.2).length,
    negative: news.filter(a => (a.sentiment || 0) < -0.2).length,
    neutral: news.filter(a => {
      const s = a.sentiment || 0;
      return s >= -0.2 && s <= 0.2;
    }).length,
  };
  
  const getSentimentIcon = (sentiment: number | null | undefined) => {
    if (!sentiment) return <Minus className="h-4 w-4 text-mut" />;
    if (sentiment > 0.2) return <TrendingUp className="h-4 w-4 text-up" />;
    if (sentiment < -0.2) return <TrendingDown className="h-4 w-4 text-dn" />;
    return <Minus className="h-4 w-4 text-mut" />;
  };
  
  const getSentimentColor = (sentiment: number | null | undefined) => {
    if (!sentiment) return "text-sub";
    if (sentiment > 0.2) return "text-up";
    if (sentiment < -0.2) return "text-dn";
    return "text-sub";
  };
  
  const getSentimentBadge = (article: NewsArticle) => {
    if (article.sentiment === null || article.sentiment === undefined) {
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="mr-1 h-3 w-3" />
          Pending Analysis
        </Badge>
      );
    }
    
    const sentiment = article.sentiment;
    const label = article.sentimentLabel || "neutral";
    const confidence = article.confidence || 0;
    
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant={sentiment > 0.2 ? "default" : sentiment < -0.2 ? "destructive" : "secondary"}
          className="text-xs"
        >
          {getSentimentIcon(sentiment)}
          <span className="ml-1">{label}</span>
        </Badge>
        {confidence > 0 && (
          <span className="text-xs text-mut">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>
    );
  };
  
  // Determine stock exchange from symbol
  const getExchangeInfo = (symbol: string) => {
    if (symbol.includes('.BR')) return 'Euronext Brussels';
    if (symbol.includes('.PA')) return 'Euronext Paris';
    if (symbol.includes('.AS')) return 'Euronext Amsterdam';
    if (symbol.includes('.MI')) return 'Milan Stock Exchange';
    if (symbol.includes('.L')) return 'London Stock Exchange';
    return null;
  };
  
  if (isLoading && !propArticles) {
    return <NewsFeedSkeleton />;
  }
  
  const needsAnalysis = news.some(article => article.sentiment === null);
  const exchange = getExchangeInfo(symbol);
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Newspaper className="mr-2 h-5 w-5" />
              Latest News & Sentiment
              {companyName && (
                <span className="ml-2 text-sm font-normal text-sub">
                  for {companyName}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Brain className="mr-1 h-3 w-3" />
                AI-Powered
              </Badge>
              {news.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={cn(
                    "mr-1 h-3 w-3",
                    isRefetching && "animate-spin"
                  )} />
                  Refresh
                </Button>
              )}
              {needsAnalysis && !isAnalyzing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={analyzeSentiment}
                  disabled={isAnalyzing}
                >
                  <Brain className="mr-1 h-3 w-3" />
                  Analyze All
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {news.length === 0 && lowRelevanceCount === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium">
                    No recent news found for <strong>{symbol}</strong>
                    {companyName && ` (${companyName})`}
                  </p>
                  
                  <div className="space-y-2 text-sm text-sub">
                    <p>This may be a smaller company with limited news coverage.</p>
                    
                    <div className="space-y-2 mt-3">
                      <p className="font-medium text-sub">Try these alternative sources:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          <strong>Company website:</strong> Check the investor relations section
                        </li>
                        {exchange && (
                          <li>
                            <strong>{exchange}:</strong> Official exchange announcements
                          </li>
                        )}
                        <li>
                          <strong>Industry publications:</strong> Sector-specific news sources
                        </li>
                        {symbol.includes('.BR') && (
                          <li>
                            <strong>Belgian financial news:</strong> De Tijd, L'Echo
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${companyName || symbol} news`)}`, '_blank')}
                    >
                      <Search className="mr-1 h-3 w-3" />
                      Search Google
                    </Button>
                    {companyName && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${companyName} investor relations`)}`, '_blank')}
                      >
                        <Building2 className="mr-1 h-3 w-3" />
                        Find IR Page
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ) : news.length === 0 && lowRelevanceCount > 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>
                    Found {lowRelevanceCount} article{lowRelevanceCount > 1 ? 's' : ''} with low relevance to {symbol}.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowLowRelevance(true)}
                  >
                    Show low relevance articles
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {lowRelevanceCount > 0 && !showLowRelevance && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      {lowRelevanceCount} low relevance article{lowRelevanceCount > 1 ? 's' : ''} hidden
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLowRelevance(true)}
                    >
                      Show all
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              {showLowRelevance && lowRelevanceCount > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Showing all articles including low relevance</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLowRelevance(false)}
                    >
                      Hide low relevance
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">
                    All ({sentimentCounts.all})
                  </TabsTrigger>
                  <TabsTrigger value="positive" className="text-up">
                    Positive ({sentimentCounts.positive})
                  </TabsTrigger>
                  <TabsTrigger value="negative" className="text-dn">
                    Negative ({sentimentCounts.negative})
                  </TabsTrigger>
                  <TabsTrigger value="neutral">
                    Neutral ({sentimentCounts.neutral})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value={selectedTab} className="space-y-4 mt-4">
                  {filteredNews.length === 0 ? (
                    <p className="text-center text-mut py-8">
                      No {selectedTab !== "all" ? selectedTab : ""} news articles found.
                    </p>
                  ) : (
                    filteredNews.map((article) => (
                      <div
                        key={article.id}
                        className={cn(
                          "border rounded-lg p-4 transition-colors",
                          article.relevanceScore && article.relevanceScore < 0.5 
                            ? "bg-fill border-border" 
                            : "hover:bg-fill"
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <h3 className="font-medium line-clamp-2">
                                {article.title}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                {article.relevanceScore && article.relevanceScore < 0.5 && (
                                  <Badge variant="outline" className="text-xs">
                                    Low relevance ({Math.round(article.relevanceScore * 100)}%)
                                  </Badge>
                                )}
                                {article.relevanceScore && article.relevanceScore >= 0.8 && (
                                  <Badge variant="secondary" className="text-xs">
                                    High relevance
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={cn(
                                "text-2xl font-bold",
                                getSentimentColor(article.sentiment)
                              )}>
                                {article.sentiment !== null && article.sentiment !== undefined
                                  ? `${article.sentiment > 0 ? '+' : ''}${Math.round(article.sentiment * 100)}%`
                                  : '—'
                                }
                              </div>
                              {getSentimentBadge(article)}
                            </div>
                          </div>
                          
                          {article.summary && (
                            <p className="text-sm text-sub line-clamp-2">
                              {article.summary}
                            </p>
                          )}
                          
                          {article.aiSummary && (
                            <Alert className="mt-2">
                              <Brain className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                {article.aiSummary}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {article.impact && (
                            <Badge variant="outline" className="text-xs">
                              {article.impact} impact
                            </Badge>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-mut mt-2">
                            <div className="flex items-center gap-4">
                              <span>{article.source}</span>
                              <span>
                                <Clock className="inline h-3 w-3 mr-1" />
                                {formatDistanceToNow(new Date(article.publishedAt), { 
                                  addSuffix: true 
                                })}
                              </span>
                            </div>
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-foreground hover:text-foreground"
                            >
                              Read more
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewsFeedSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}