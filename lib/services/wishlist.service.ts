import { prisma } from '@/lib/prisma';
import { marketDataService } from './market-data.service';
import { fundamentalAnalysisService } from './fundamental-analysis.service';
import { technicalAnalysisService } from './technical-analysis.service';
import { newsService } from './news.service';
import { IntrinsicValueService } from './intrinsic-value.service';
import yahooFinance from '@/lib/yahoo-finance';

export interface WishlistItemWithScores {
  id: string;
  ticker: string;
  name: string;
  currency: string;
  addedPrice: number;
  currentPrice: number;
  targetPrice: number | null;
  notes: string | null;
  createdAt: Date;
  priceChange: number;
  priceChangePercent: number;
  fundamentalScore: number | null;
  analystScore: number | null;
  technicalScore: number | null;
  sentimentScore: number | null;
  intrinsicScore: number | null;
  compositeScore: number | null;
  targetPriceUpside: number | null;
}

export class WishlistService {
  async getOrCreateWishlist(userId: string) {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: true }
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: true }
      });
    }

    return wishlist;
  }

  async addToWishlist(
    userId: string,
    ticker: string,
    targetPrice?: number,
    notes?: string
  ) {
    // Validate ticker exists
    const quote = await yahooFinance.quote(ticker);
    if (!quote || !quote.regularMarketPrice) {
      throw new Error('Invalid ticker symbol');
    }

    // Get or create wishlist
    const wishlist = await this.getOrCreateWishlist(userId);

    // Check if already in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_ticker: {
          wishlistId: wishlist.id,
          ticker: ticker.toUpperCase()
        }
      }
    });

    if (existingItem) {
      throw new Error('This stock is already in your wishlist');
    }

    // Check limit
    const itemCount = await prisma.wishlistItem.count({
      where: { wishlistId: wishlist.id }
    });

    if (itemCount >= 50) {
      throw new Error('Wishlist limit reached (50 items maximum)');
    }

    // Check if already in portfolio
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: { positions: { where: { ticker: ticker.toUpperCase() } } }
    });

    if (portfolio?.positions && portfolio.positions.length > 0) {
      throw new Error('This stock is already in your portfolio');
    }

    // Create wishlist item
    const item = await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        ticker: ticker.toUpperCase(),
        name: quote.shortName || quote.longName || ticker,
        currency: quote.currency || 'USD',
        addedPrice: quote.regularMarketPrice,
        currentPrice: quote.regularMarketPrice,
        targetPrice,
        notes
      }
    });

    return item;
  }

  async removeFromWishlist(userId: string, itemId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const item = await prisma.wishlistItem.findFirst({
      where: {
        id: itemId,
        wishlistId: wishlist.id
      }
    });

    if (!item) {
      throw new Error('Wishlist item not found');
    }

    await prisma.wishlistItem.delete({
      where: { id: itemId }
    });

    return { success: true };
  }

  async updateWishlistItem(
    userId: string,
    itemId: string,
    updates: {
      targetPrice?: number | null;
      notes?: string | null;
    }
  ) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const item = await prisma.wishlistItem.findFirst({
      where: {
        id: itemId,
        wishlistId: wishlist.id
      }
    });

    if (!item) {
      throw new Error('Wishlist item not found');
    }

    return await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updates
    });
  }

  async getWishlistWithScores(userId: string): Promise<WishlistItemWithScores[]> {
    const wishlist = await this.getOrCreateWishlist(userId);
    const items = await prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch current prices and scores for all items
    const itemsWithScores = await Promise.all(
      items.map(async (item) => {
        try {
          // Get current price
          const quote = await yahooFinance.quote(item.ticker);
          const currentPrice = quote.regularMarketPrice || Number(item.currentPrice);

          // Update current price in DB
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: { currentPrice }
          });

          // Calculate price changes
          const priceChange = currentPrice - Number(item.addedPrice);
          const priceChangePercent = (priceChange / Number(item.addedPrice)) * 100;

          // Get fundamental score
          let fundamentalScore: number | null = null;
          try {
            const fundamentals = await fundamentalAnalysisService.fetchFundamentals(item.ticker);
            fundamentalScore = fundamentals.score.total;
          } catch (error) {
            console.error(`Failed to fetch fundamentals for ${item.ticker}:`, error);
          }

          // Get analyst score and target price upside
          let analystScore: number | null = null;
          let targetPriceUpside: number | null = null;
          try {
            const analystRating = await prisma.analystRating.findUnique({
              where: { symbol: item.ticker }
            });

            if (analystRating) {
              analystScore = Number(analystRating.score);

              if (analystRating.targetPrice) {
                const targetPrice = Number(analystRating.targetPrice);
                targetPriceUpside = ((targetPrice - currentPrice) / currentPrice) * 100;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch analyst rating for ${item.ticker}:`, error);
          }

          // Get technical score
          let technicalScore: number | null = null;
          try {
            const historicalData = await marketDataService.getHistoricalData(item.ticker, '1Y');
            if (historicalData && historicalData.length > 0) {
              const prices = historicalData.map(d => d.value);
              const volumes = historicalData.map(d => d.volume);
              const indicators = technicalAnalysisService.calculateIndicators(prices, volumes);
              // Use the actual calculated score instead of mapping signal
              technicalScore = typeof indicators.score === 'number' ? indicators.score : null;
            }
          } catch (error) {
            console.error(`Failed to fetch technical data for ${item.ticker}:`, error);
          }

          // Get sentiment score
          // AUD-05: previously called this app's own /api/news/[symbol] route via
          // `fetch()` with no session cookie forwarded — since that route requires
          // auth (ONB-05, 2026-07-16), the call always 401'd and this score was
          // silently always null. Call the service directly instead.
          let sentimentScore: number | null = null;
          try {
            const articles = await newsService.getAnalyzedNewsForSymbol(item.ticker, {
              analyze: true,
              limit: 20,
            });
            sentimentScore = this.calculateSentimentScore(articles);
          } catch (error) {
            console.error(`Failed to fetch sentiment data for ${item.ticker}:`, error);
          }

          // Get intrinsic value score
          // AUD-05: same self-fetch issue as sentiment above — call the service
          // directly instead of hitting our own now-authenticated route over HTTP.
          let intrinsicScore: number | null = null;
          try {
            const intrinsicData = await IntrinsicValueService.calculateIntrinsicValue(
              item.ticker,
              currentPrice
            );
            intrinsicScore = this.upsideToScore(intrinsicData.upsidePercent);
          } catch (error) {
            console.error(`Failed to fetch intrinsic value for ${item.ticker}:`, error);
          }

          // Calculate composite score
          let compositeScore: number | null = null;
          const scores = [fundamentalScore, analystScore, technicalScore, sentimentScore, intrinsicScore];
          const validScores = scores.filter((s): s is number => s !== null);

          if (validScores.length > 0) {
            const weights = {
              intrinsicValue: 0.25,
              fundamental: 0.25,
              technical: 0.20,
              sentiment: 0.15,
              analyst: 0.15,
            };

            // AUD-05: `?? 5` instead of `|| 5` — a legitimate score of 0 (e.g.
            // maximally bearish sentiment or a fully-overvalued intrinsic
            // estimate) must not be treated as "missing" and replaced with a
            // neutral 5.
            const sum =
              (intrinsicScore ?? 5) * weights.intrinsicValue +
              (fundamentalScore ?? 5) * weights.fundamental +
              (technicalScore ?? 5) * weights.technical +
              (sentimentScore ?? 5) * weights.sentiment +
              (analystScore ?? 5) * weights.analyst;

            compositeScore = Math.round(sum * 10) / 10;
          }

          return {
            id: item.id,
            ticker: item.ticker,
            name: item.name,
            currency: item.currency,
            addedPrice: Number(item.addedPrice),
            currentPrice,
            targetPrice: item.targetPrice ? Number(item.targetPrice) : null,
            notes: item.notes,
            createdAt: item.createdAt,
            priceChange,
            priceChangePercent,
            fundamentalScore,
            analystScore,
            technicalScore,
            sentimentScore,
            intrinsicScore,
            compositeScore,
            targetPriceUpside
          };
        } catch (error) {
          console.error(`Failed to process wishlist item ${item.ticker}:`, error);
          // Return item with basic data if fetching fails
          return {
            id: item.id,
            ticker: item.ticker,
            name: item.name,
            currency: item.currency,
            addedPrice: Number(item.addedPrice),
            currentPrice: Number(item.currentPrice),
            targetPrice: item.targetPrice ? Number(item.targetPrice) : null,
            notes: item.notes,
            createdAt: item.createdAt,
            priceChange: Number(item.currentPrice) - Number(item.addedPrice),
            priceChangePercent: ((Number(item.currentPrice) - Number(item.addedPrice)) / Number(item.addedPrice)) * 100,
            fundamentalScore: null,
            analystScore: null,
            technicalScore: null,
            sentimentScore: null,
            intrinsicScore: null,
            compositeScore: null,
            targetPriceUpside: null
          };
        }
      })
    );

    return itemsWithScores;
  }

  private sentimentToScore(sent: number | null | undefined): number {
    const s = typeof sent === "number" ? sent : 0; // -1..1
    const score = (s + 1) * 5; // 0..10
    return Math.max(0, Math.min(10, score));
  }

  private upsideToScore(upsidePercent: number | null | undefined): number {
    if (upsidePercent === null || upsidePercent === undefined) return 5;
    const min = -25;
    const max = 30;
    const clamped = Math.max(min, Math.min(max, upsidePercent));
    const normalized = (clamped - min) / (max - min);
    return Math.round(normalized * 10 * 10) / 10;
  }

  private calculateSentimentScore(articles: Array<{ sentiment?: number | null; impact?: string | null; relevanceScore?: number | null }>): number {
    if (!Array.isArray(articles) || articles.length === 0) return 5;

    let weighted = 0;
    let totalW = 0;

    for (const a of articles) {
      const s = a.sentiment ?? 0;
      let w = 1;
      if (a.impact === "high") w = 3;
      else if (a.impact === "medium") w = 2;
      const rel = a.relevanceScore ?? 0.5;
      const weight = w * rel;
      weighted += s * weight;
      totalW += weight;
    }

    const avg = totalW > 0 ? weighted / totalW : 0;
    return Math.round(this.sentimentToScore(avg) * 10) / 10;
  }

  async syncWishlistPrices(userId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const items = await prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id }
    });

    await Promise.all(
      items.map(async (item) => {
        try {
          const quote = await yahooFinance.quote(item.ticker);
          if (quote.regularMarketPrice) {
            await prisma.wishlistItem.update({
              where: { id: item.id },
              data: { currentPrice: quote.regularMarketPrice }
            });
          }
        } catch (error) {
          console.error(`Failed to sync price for ${item.ticker}:`, error);
        }
      })
    );
  }
}

export const wishlistService = new WishlistService();
