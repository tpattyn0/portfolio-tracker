import { prisma } from '@/lib/prisma';
import axios from 'axios';
import yahooFinance from '@/lib/yahoo-finance';
import NodeCache from 'node-cache';

interface NewsArticleData {
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: Date;
  imageUrl?: string;
  symbols: string[];
  relevanceScore?: number;
}

export class NewsAggregationService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({ stdTTL: 300 });
  }
  
  async fetchNewsForSymbol(symbol: string, companyName?: string): Promise<NewsArticleData[]> {
    const cacheKey = `news_${symbol}`;
    const cached = this.cache.get<NewsArticleData[]>(cacheKey);
    
    if (cached) {
        return cached;
    }
    
    try {
        // For Belgian/European stocks, clean the symbol
        const cleanSymbol = symbol.split('.')[0]; // BTLS.BR -> BTLS
        const searchTerms = [cleanSymbol];
        
        // Add company name variations
        if (companyName) {
        searchTerms.push(companyName);
        // For biotech companies, add common terms
        if (companyName.toLowerCase().includes('bio') || 
            companyName.toLowerCase().includes('pharma')) {
            searchTerms.push(`${companyName} biotech`);
            searchTerms.push(`${companyName} pharmaceutical`);
        }
        }
        
        // Try to get news from multiple sources
        const [yahooNews, newsApiArticles] = await Promise.all([
        this.fetchYahooFinanceNews(symbol),
        this.fetchNewsAPI(searchTerms, symbol),
        ]);
        
        let allNews = [...yahooNews, ...newsApiArticles];
        
        // Calculate relevance with stricter criteria
        allNews = this.calculateRelevance(allNews, symbol, searchTerms);
        
        // Filter out articles with very low relevance
        const relevantNews = allNews.filter(article => 
        (article.relevanceScore || 0) > 0.4 // Increased from 0.3
        );
        
        // If no relevant news found, return empty array instead of generic news
        if (relevantNews.length === 0) {
        this.cache.set(cacheKey, []); // Cache empty result
        return [];
        }
        
        // Sort by relevance and date
        const sorted = relevantNews.sort((a, b) => {
        const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
        if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
        
        // Take only the most relevant articles
        const topArticles = sorted.slice(0, 10);
        
        this.cache.set(cacheKey, topArticles);
        return topArticles;
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
    }
  
  private calculateRelevance(
    articles: NewsArticleData[], 
    symbol: string, 
    searchTerms: string[]
  ): NewsArticleData[] {
    return articles.map(article => {
      let relevanceScore = 0;
      const titleLower = article.title.toLowerCase();
      const summaryLower = (article.summary || '').toLowerCase();
      const contentLower = (article.content || '').toLowerCase();
      
      // Clean symbol for comparison (remove exchange suffix)
      const cleanSymbol = symbol.split('.')[0].toLowerCase();
      
      // Check for exact symbol match
      if (titleLower.includes(cleanSymbol) || 
          summaryLower.includes(cleanSymbol)) {
        relevanceScore += 0.5;
      }
      
      // Check for company name matches
      searchTerms.forEach(term => {
        const termLower = term.toLowerCase();
        if (termLower.length > 2) { // Ignore very short terms
          if (titleLower.includes(termLower)) {
            relevanceScore += 0.4;
          }
          if (summaryLower.includes(termLower)) {
            relevanceScore += 0.2;
          }
          if (contentLower.includes(termLower)) {
            relevanceScore += 0.1;
          }
        }
      });
      
      // Check if symbols array contains our symbol
      if (article.symbols.some(s => 
        s.toLowerCase() === symbol.toLowerCase() || 
        s.toLowerCase() === cleanSymbol
      )) {
        relevanceScore += 0.3;
      }
      
      // Penalty for unrelated tickers mentioned prominently
      const unrelatedTickers = /\b[A-Z]{2,5}\b/g;
      const tickersInTitle = titleLower.match(unrelatedTickers) || [];
      tickersInTitle.forEach(ticker => {
        if (!searchTerms.some(term => 
          term.toLowerCase().includes(ticker.toLowerCase())
        )) {
          relevanceScore -= 0.2;
        }
      });
      
      // Cap relevance score between 0 and 1
      article.relevanceScore = Math.max(0, Math.min(1, relevanceScore));
      return article;
    });
  }
  
  private async fetchYahooFinanceNews(symbol: string): Promise<NewsArticleData[]> {
    try {
      // Use the exact symbol for Yahoo Finance
      const result = await yahooFinance.search(symbol, {
        newsCount: 10,
      });
      
      const newsArticles: NewsArticleData[] = [];
      
      if (result.news && Array.isArray(result.news)) {
        result.news.forEach((article) => {
          if (article.title && article.link) {
            newsArticles.push({
              title: article.title,
              summary: (typeof article.summary === 'string' ? article.summary : null) || article.title,
              url: article.link,
              source: article.publisher || 'Yahoo Finance',
              publishedAt: article.providerPublishTime 
                ? new Date(article.providerPublishTime)
                : new Date(),
              imageUrl: article.thumbnail?.resolutions?.[0]?.url,
              symbols: article.relatedTickers || [symbol],
            });
          }
        });
      }
      
      return newsArticles;
    } catch (error) {
      console.error('Yahoo Finance news error:', error);
      return [];
    }
  }
  
  private async fetchNewsAPI(
    searchTerms: string[], 
    symbol: string
  ): Promise<NewsArticleData[]> {
    if (!process.env.NEWS_API_KEY) {
      return [];
    }
    
    try {
      // Build search query from terms
      const query = searchTerms
        .map(term => `"${term}"`)
        .join(' OR ');
      
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: query,
          apiKey: process.env.NEWS_API_KEY,
          language: 'en',
          sortBy: 'relevancy', // Changed from publishedAt to relevancy
          pageSize: 10,
        },
        timeout: 5000,
      });
      
      if (!response.data.articles) {
        return [];
      }
      
      return response.data.articles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((article: any) => article.title && article.url)
        .map((article: any) => ({
          title: article.title,
          summary: article.description,
          content: article.content,
          url: article.url,
          source: article.source?.name || 'NewsAPI',
          author: article.author,
          publishedAt: new Date(article.publishedAt),
          imageUrl: article.urlToImage,
          symbols: [symbol],
        }));
    } catch (error: unknown) {
      console.error('NewsAPI error:', error instanceof Error ? error.message : error);
      return [];
    }
  }
  
  private deduplicateNews(articles: NewsArticleData[]): NewsArticleData[] {
    const seen = new Set<string>();
    const unique: NewsArticleData[] = [];
    
    for (const article of articles) {
      const key = article.title.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 50);
      
      if (!seen.has(key) && !seen.has(article.url)) {
        seen.add(key);
        seen.add(article.url);
        unique.push(article);
      }
    }
    
    return unique;
  }
  
  async saveArticlesToDatabase(articles: NewsArticleData[]): Promise<void> {
    for (const article of articles) {
      try {
        await prisma.newsArticle.upsert({
          where: { url: article.url },
          update: {
            title: article.title,
            summary: article.summary,
            content: article.content,
            source: article.source,
            author: article.author,
            publishedAt: article.publishedAt,
            imageUrl: article.imageUrl,
            symbols: article.symbols,
            relevanceScore: article.relevanceScore,
            updatedAt: new Date(),
          },
          create: {
            title: article.title,
            summary: article.summary,
            content: article.content,
            url: article.url,
            source: article.source,
            author: article.author,
            publishedAt: article.publishedAt,
            imageUrl: article.imageUrl,
            symbols: article.symbols,
            relevanceScore: article.relevanceScore,
          },
        });
      } catch (error) {
        console.error('Error saving article:', article.title, error);
      }
    }
  }

  /**
   * DB-first fetch of relevant, sentiment-analyzed articles for a symbol —
   * refreshes from upstream sources if the cache is thin, and runs sentiment
   * analysis (Gemini, if configured) on a batch of unanalyzed articles.
   *
   * Extracted from app/api/news/[symbol]/route.ts (AUD-05, 2026-07-17 audit)
   * so callers running server-side (e.g. wishlist scoring) can get the same
   * data without an HTTP round-trip to their own route.
   */
  async getAnalyzedNewsForSymbol(
    symbol: string,
    options: { companyName?: string; limit?: number; analyze?: boolean } = {}
  ) {
    const { companyName, limit = 20, analyze = true } = options;

    let articles = await prisma.newsArticle.findMany({
      where: {
        symbols: { has: symbol },
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        relevanceScore: { gte: 0.5 },
      },
      orderBy: [{ relevanceScore: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
    });

    if (articles.length < 2) {
      const freshNews = await this.fetchNewsForSymbol(symbol, companyName);
      const relevantNews = freshNews.filter(
        (article) => (article.relevanceScore || 0) >= 0.4
      );

      if (relevantNews.length > 0) {
        await this.saveArticlesToDatabase(relevantNews);
      }

      articles = await prisma.newsArticle.findMany({
        where: {
          symbols: { has: symbol },
          relevanceScore: { gte: 0.5 },
        },
        orderBy: [{ relevanceScore: 'desc' }, { publishedAt: 'desc' }],
        take: limit,
      });
    }

    if (articles.length === 0) {
      return [];
    }

    if (analyze && process.env.GEMINI_API_KEY) {
      const unanalyzedArticles = articles.filter((a) => a.sentiment === null);

      if (unanalyzedArticles.length > 0) {
        const articlesToAnalyze = unanalyzedArticles.slice(0, 3);

        // Lazy import avoids a hard module-scope dependency on
        // GEMINI_API_KEY for every caller of news.service.ts (see AGENT.md
        // fragile surfaces — sentiment.service throws at import time if the
        // key is unset).
        const { sentimentService } = await import('./sentiment.service');

        for (const article of articlesToAnalyze) {
          try {
            await sentimentService.analyzeAndUpdateArticle(article.id);
          } catch (error) {
            console.error(`Failed to analyze article ${article.id}:`, error);
          }
        }

        articles = await prisma.newsArticle.findMany({
          where: {
            symbols: { has: symbol },
            relevanceScore: { gte: 0.5 },
          },
          orderBy: [{ relevanceScore: 'desc' }, { publishedAt: 'desc' }],
          take: limit,
        });
      }
    }

    return articles;
  }
}

export const newsService = new NewsAggregationService();