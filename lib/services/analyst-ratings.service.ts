import yahooFinance from '@/lib/yahoo-finance';
import { prisma } from '@/lib/prisma';
import { AnalystRating, Prisma } from '@prisma/client';

export interface AnalystRatings {
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

export class AnalystRatingsService {
  async fetchAnalystRatings(symbol: string): Promise<AnalystRatings> {
    try {
      // Check cache first
      const cached = await prisma.analystRating.findUnique({
        where: { symbol },
        select: {
          id: true,
          symbol: true,
          targetPrice: true,
          strongBuy: true,
          buy: true,
          hold: true,
          sell: true,
          strongSell: true,
          totalAnalysts: true,
          averageRating: true,
          score: true,
          scoreInterpretation: true,
          lastUpdated: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // If data is less than 24 hours old, use cached
      if (cached && cached.lastUpdated > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        return this.formatCachedData(cached);
      }

      // Fetch fresh data from Yahoo Finance
      const quoteSummary = await yahooFinance.quoteSummary(symbol, {
        modules: [
          'financialData',
          'recommendationTrend',
          'upgradeDowngradeHistory',
          'earningsTrend'
        ]
      });

      // Extract and process ratings
      const ratings = this.extractRatings(quoteSummary);
      
      // Calculate score and interpretation
      const score = this.calculateScore(ratings);
      const scoreInterpretation = this.getScoreInterpretation(score);

      // Save to database
      await this.saveToDatabase(symbol, { ...ratings, score, scoreInterpretation });

      return { ...ratings, score, scoreInterpretation };
    } catch (error) {
      console.error(`Failed to fetch analyst ratings for ${symbol}:`, error);
      throw error;
    }
  }

  private extractRatings(data: any): Omit<AnalystRatings, 'score' | 'scoreInterpretation'> {
    const financialData = data.financialData || {};
    const recommendationTrend = data.recommendationTrend?.trend?.[0] || {};
    
    const strongBuy = recommendationTrend.strongBuy || 0;
    const buy = recommendationTrend.buy || 0;
    const hold = recommendationTrend.hold || 0;
    const sell = recommendationTrend.sell || 0;
    const strongSell = recommendationTrend.strongSell || 0;
    
    const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
    
    // Calculate average rating (1=Strong Buy, 5=Strong Sell)
    const averageRating = totalAnalysts > 0 
      ? (strongBuy * 1 + buy * 2 + hold * 3 + sell * 4 + strongSell * 5) / totalAnalysts
      : null;
    
    return {
      targetPrice: financialData.targetMeanPrice || null,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      totalAnalysts,
      averageRating,
      lastUpdated: new Date().toISOString()
    };
  }

  private calculateScore(ratings: Omit<AnalystRatings, 'score' | 'scoreInterpretation'>): number {
    if (ratings.totalAnalysts === 0) return 5; // Neutral score if no ratings
    
    // Weighted score where Strong Buy = 10, Buy = 8, Hold = 5, Sell = 2, Strong Sell = 0
    const weightedScore = (
      (ratings.strongBuy * 10) +
      (ratings.buy * 8) +
      (ratings.hold * 5) +
      (ratings.sell * 2) +
      (ratings.strongSell * 0)
    ) / ratings.totalAnalysts;
    
    // Normalize to 1-10 scale
    return Math.min(10, Math.max(1, weightedScore));
  }

  private getScoreInterpretation(score: number): string {
    if (score >= 7) return 'Strong Buy - Analysts are very bullish on this stock';
    if (score >= 5.5) return 'Buy - Analysts are generally positive about this stock';
    if (score >= 4.5) return 'Hold - Analysts are neutral on this stock';
    if (score >= 3) return 'Sell - Analysts are generally negative about this stock';
    return 'Strong Sell - Analysts are very bearish on this stock';
  }

  private async saveToDatabase(symbol: string, data: AnalystRatings) {
    const { lastUpdated, ...ratingsData } = data;
    
    await prisma.analystRating.upsert({
      where: { symbol },
      update: {
        targetPrice: data.targetPrice !== null ? new Prisma.Decimal(data.targetPrice) : null,
        strongBuy: data.strongBuy,
        buy: data.buy,
        hold: data.hold,
        sell: data.sell,
        strongSell: data.strongSell,
        totalAnalysts: data.totalAnalysts,
        averageRating: data.averageRating !== null ? new Prisma.Decimal(data.averageRating) : null,
        score: data.score,
        scoreInterpretation: data.scoreInterpretation,
        lastUpdated: new Date()
      },
      create: {
        symbol,
        targetPrice: data.targetPrice !== null ? new Prisma.Decimal(data.targetPrice) : null,
        strongBuy: data.strongBuy,
        buy: data.buy,
        hold: data.hold,
        sell: data.sell,
        strongSell: data.strongSell,
        totalAnalysts: data.totalAnalysts,
        averageRating: data.averageRating !== null ? new Prisma.Decimal(data.averageRating) : null,
        score: data.score,
        scoreInterpretation: data.scoreInterpretation,
        lastUpdated: new Date()
      }
    });
  }

  private formatCachedData(cached: AnalystRating): AnalystRatings {
    return {
      targetPrice: cached.targetPrice ? Number(cached.targetPrice) : null,
      strongBuy: cached.strongBuy,
      buy: cached.buy,
      hold: cached.hold,
      sell: cached.sell,
      strongSell: cached.strongSell,
      totalAnalysts: cached.totalAnalysts,
      averageRating: cached.averageRating ? Number(cached.averageRating) : null,
      score: cached.score || 5,
      scoreInterpretation: cached.scoreInterpretation || 'No analyst data available',
      lastUpdated: cached.lastUpdated?.toISOString() || new Date().toISOString()
    };
  }
}

export const analystRatingsService = new AnalystRatingsService();
