import { safeQuoteSummary } from '@/lib/yahoo-finance';
import { prisma } from '@/lib/prisma';
import { AnalystRating, Prisma } from '@prisma/client';

export interface AnalystRevision {
  firm: string;
  action: string;
  fromGrade: string | null;
  toGrade: string | null;
  date: string;
}

export interface AnalystRatings {
  targetPrice: number | null;
  targetLowPrice: number | null;
  targetHighPrice: number | null;
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
  // Non-persisted (OD-3/A4, plans/2026-07-19-research-tab-fixes.md): no
  // AnalystRating DB column exists for this yet, so it is present on a fresh
  // Yahoo fetch and defaults to [] on a 24h cache hit (formatCachedData).
  revisions: AnalystRevision[];
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

      // Fetch fresh data from Yahoo Finance.
      // Note: no hard module guard here (unlike fundamentals/market-data) —
      // a missing `recommendationTrend` legitimately means "no analyst
      // coverage" and extractRatings already returns totalAnalysts: 0,
      // which calculateScore treats as a valid neutral 5. Only the wrapper's
      // own null-result re-throw applies.
      const quoteSummary = await safeQuoteSummary(symbol, {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractRatings(data: Record<string, any>): Omit<AnalystRatings, 'score' | 'scoreInterpretation'> {
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

    const revisions = this.extractRevisions(data.upgradeDowngradeHistory);

    return {
      targetPrice: financialData.targetMeanPrice || null,
      targetLowPrice: financialData.targetLowPrice ?? null,
      targetHighPrice: financialData.targetHighPrice ?? null,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      totalAnalysts,
      averageRating,
      lastUpdated: new Date().toISOString(),
      revisions,
    };
  }

  /**
   * Extracts recent analyst revisions from Yahoo's `upgradeDowngradeHistory`
   * module (already fetched, previously unread — TD-DTL-REV). Non-persisted:
   * OD-3/A4, plans/2026-07-19-research-tab-fixes.md — returned only on a
   * fresh Yahoo fetch, absent (defaults to []) on a 24h cache hit since no
   * `AnalystRating` DB column exists for this yet.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractRevisions(upgradeDowngradeHistory: Record<string, any> | undefined): AnalystRevision[] {
    const history = upgradeDowngradeHistory?.history;
    if (!Array.isArray(history)) return [];

    return history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((entry: Record<string, any>) => entry && entry.firm && entry.action && entry.epochGradeDate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((entry: Record<string, any>) => ({
        firm: String(entry.firm),
        action: String(entry.action),
        fromGrade: entry.fromGrade ? String(entry.fromGrade) : null,
        toGrade: entry.toGrade ? String(entry.toGrade) : null,
        date: new Date(entry.epochGradeDate).toISOString(),
      }));
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
      // Non-persisted (OD-3/A4): no AnalystRating DB columns for these yet,
      // so a cache hit returns null/[] rather than the fresh-fetch values.
      targetLowPrice: null,
      targetHighPrice: null,
      revisions: [],
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
