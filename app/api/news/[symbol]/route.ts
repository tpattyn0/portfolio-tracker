// app/api/news/[symbol]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { newsService } from '@/lib/services/news.service';
import { sentimentService } from '@/lib/services/sentiment.service';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const companyName = searchParams.get('name') || undefined;
    const analyze = searchParams.get('analyze') !== 'false';
    
    console.log(`Fetching news for ${symbol} (${companyName})`);
    
    // Try to get company-specific news first
    let articles = await prisma.newsArticle.findMany({
      where: {
        symbols: { has: symbol },
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
        // Only get articles with decent relevance
        relevanceScore: { gte: 0.5 }, // Increased threshold
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { publishedAt: 'desc' }
      ],
      take: limit,
    });
    
    // If we have very few relevant articles, fetch fresh
    if (articles.length < 2) {
      console.log(`Only ${articles.length} relevant articles found, fetching fresh news...`);
      const freshNews = await newsService.fetchNewsForSymbol(symbol, companyName);
      
      // Only save articles with good relevance
      const relevantNews = freshNews.filter(article => 
        (article.relevanceScore || 0) >= 0.4
      );
      
      if (relevantNews.length > 0) {
        await newsService.saveArticlesToDatabase(relevantNews);
      } else {
        console.log(`No relevant news found for ${symbol} - this may be a small company`);
      }
      
      // Re-fetch from database
      articles = await prisma.newsArticle.findMany({
        where: {
          symbols: { has: symbol },
          relevanceScore: { gte: 0.5 }, // Only high relevance
        },
        orderBy: [
          { relevanceScore: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit,
      });
    }
    
    // For small companies with no news, return empty array instead of generic news
    if (articles.length === 0) {
      console.log(`No relevant news available for ${symbol}`);
      return NextResponse.json([]);
    }
    
    // Analyze sentiment for unanalyzed articles
    if (analyze && process.env.GEMINI_API_KEY && articles.length > 0) {
      const unanalyzedArticles = articles.filter(a => a.sentiment === null);
      
      if (unanalyzedArticles.length > 0) {
        console.log(`Analyzing sentiment for ${unanalyzedArticles.length} articles...`);
        
        const articlesToAnalyze = unanalyzedArticles.slice(0, 3);
        
        for (const article of articlesToAnalyze) {
          try {
            await sentimentService.analyzeAndUpdateArticle(article.id);
          } catch (error) {
            console.error(`Failed to analyze article ${article.id}:`, error);
          }
        }
        
        // Re-fetch to get updated articles
        articles = await prisma.newsArticle.findMany({
          where: {
            symbols: { has: symbol },
            relevanceScore: { gte: 0.5 },
          },
          orderBy: [
            { relevanceScore: 'desc' },
            { publishedAt: 'desc' }
          ],
          take: limit,
        });
      }
    }
    
    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}