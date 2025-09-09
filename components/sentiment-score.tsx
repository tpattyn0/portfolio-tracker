"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsArticle {
  sentiment: number | null;
  sentimentLabel: string | null;
  confidence: number | null;
  impact: string | null;
  relevanceScore?: number | null;
}

interface SentimentScoreProps {
  articles: NewsArticle[];
  symbol: string;
}

export function SentimentScore({ articles, symbol }: SentimentScoreProps) {
  const sentimentData = useMemo(() => {
    // Filter articles with sentiment
    const analyzedArticles = articles.filter(a => a.sentiment !== null);
    
    if (analyzedArticles.length === 0) {
      return {
        score: 0,
        label: 'Neutral',
        positive: 0,
        negative: 0,
        neutral: 0,
        total: articles.length,
        analyzed: 0,
        confidence: 0,
      };
    }
    
    // Calculate weighted sentiment based on impact and relevance
    let weightedSum = 0;
    let totalWeight = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let confidenceSum = 0;
    
    analyzedArticles.forEach(article => {
      const sentiment = article.sentiment || 0;
      const relevance = article.relevanceScore || 0.5;
      
      // Weight by impact
      let impactWeight = 1;
      if (article.impact === 'high') impactWeight = 3;
      else if (article.impact === 'medium') impactWeight = 2;
      
      // Combined weight
      const weight = impactWeight * relevance;
      
      weightedSum += sentiment * weight;
      totalWeight += weight;
      confidenceSum += article.confidence || 0.5;
      
      // Count by category
      if (sentiment > 0.2) positiveCount++;
      else if (sentiment < -0.2) negativeCount++;
      else neutralCount++;
    });
    
    const averageSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const averageConfidence = analyzedArticles.length > 0 
      ? confidenceSum / analyzedArticles.length 
      : 0;
    
    // Calculate label
    let label = 'Neutral';
    if (averageSentiment > 0.3) label = 'Bullish';
    else if (averageSentiment > 0.1) label = 'Slightly Bullish';
    else if (averageSentiment < -0.3) label = 'Bearish';
    else if (averageSentiment < -0.1) label = 'Slightly Bearish';
    
    // Convert to 0-100 scale for display
    const displayScore = Math.round((averageSentiment + 1) * 50);
    
    return {
      score: averageSentiment,
      displayScore,
      label,
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
      total: articles.length,
      analyzed: analyzedArticles.length,
      confidence: averageConfidence,
    };
  }, [articles]);
  
  const getScoreColor = (score: number) => {
    if (score > 0.3) return 'text-green-600';
    if (score > 0.1) return 'text-green-500';
    if (score < -0.3) return 'text-red-600';
    if (score < -0.1) return 'text-red-500';
    return 'text-gray-600';
  };
  
  const getScoreIcon = (score: number) => {
    if (score > 0.1) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (score < -0.1) return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Activity className="h-5 w-5 text-gray-500" />;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            Sentiment Analysis
          </span>
          <Badge variant="outline" className="text-xs">
            <Brain className="mr-1 h-3 w-3" />
            AI-Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            {getScoreIcon(sentimentData.score)}
            <span className={cn(
              "text-3xl font-bold",
              getScoreColor(sentimentData.score)
            )}>
              {sentimentData.displayScore}
            </span>
            <span className="text-sm text-gray-500">/100</span>
          </div>
          <p className={cn(
            "text-lg font-medium",
            getScoreColor(sentimentData.score)
          )}>
            {sentimentData.label}
          </p>
          {sentimentData.confidence > 0 && (
            <p className="text-xs text-gray-500">
              {Math.round(sentimentData.confidence * 100)}% confidence
            </p>
          )}
        </div>
        
        {/* Sentiment Distribution */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sentiment Distribution</span>
            <span>{sentimentData.analyzed}/{sentimentData.total} analyzed</span>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-600">Positive</span>
                <span className="text-green-600">{sentimentData.positive}</span>
              </div>
              <Progress 
                value={(sentimentData.positive / Math.max(sentimentData.analyzed, 1)) * 100} 
                className="h-2 bg-green-100"
              />
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Neutral</span>
                <span className="text-gray-600">{sentimentData.neutral}</span>
              </div>
              <Progress 
                value={(sentimentData.neutral / Math.max(sentimentData.analyzed, 1)) * 100} 
                className="h-2 bg-gray-100"
              />
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-600">Negative</span>
                <span className="text-red-600">{sentimentData.negative}</span>
              </div>
              <Progress 
                value={(sentimentData.negative / Math.max(sentimentData.analyzed, 1)) * 100} 
                className="h-2 bg-red-100"
              />
            </div>
          </div>
        </div>
        
        {/* Interpretation */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            {sentimentData.score > 0.3 
              ? `Strong positive sentiment for ${symbol}. News coverage is predominantly optimistic.`
              : sentimentData.score > 0.1
              ? `Mildly positive sentiment for ${symbol}. News coverage leans bullish.`
              : sentimentData.score < -0.3
              ? `Strong negative sentiment for ${symbol}. News coverage is predominantly pessimistic.`
              : sentimentData.score < -0.1
              ? `Mildly negative sentiment for ${symbol}. News coverage leans bearish.`
              : `Neutral sentiment for ${symbol}. News coverage is balanced.`
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}