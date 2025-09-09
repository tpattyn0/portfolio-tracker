import yahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';

interface FundamentalMetrics {
  valuation: {
    peRatio: number | null;
    pegRatio: number | null;
    psRatio: number | null;
    pbRatio: number | null;
    evToEbitda: number | null;
    marketCap: number | null;
  };
  profitability: {
    profitMargin: number | null;
    operatingMargin: number | null;
    roe: number | null;
    roa: number | null;
    roic: number | null;
  };
  growth: {
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    fcfGrowth: number | null;
  };
  financial: {
    currentRatio: number | null;
    quickRatio: number | null;
    debtToEquity: number | null;
    interestCoverage: number | null;
  };
  dividend: {
    yield: number | null;
    payoutRatio: number | null;
    growthRate: number | null;
  };
  score: {
    total: number;
    breakdown: {
      valuation: number;
      profitability: number;
      growth: number;
      financial: number;
      dividend: number;
    };
    interpretation: string;
  };
}

export class FundamentalAnalysisService {
  async fetchFundamentals(symbol: string): Promise<FundamentalMetrics> {
    try {
      // Check cache first
      const cached = await prisma.fundamentalData.findUnique({
        where: { symbol }
      });

      // If data is less than 24 hours old, use cached
      if (cached && cached.lastUpdated > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        return this.formatCachedData(cached);
      }

      // Fetch fresh data from Yahoo Finance
      const quoteSummary = await yahooFinance.quoteSummary(symbol, {
        modules: [
          'price',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'earningsHistory',
          'earningsTrend'
        ]
      });

      console.log('Yahoo Finance data for', symbol, quoteSummary);

      // Extract metrics
      const metrics = this.extractMetrics(quoteSummary);
      
      // Calculate scores
      const score = this.calculateFundamentalScore(metrics);
      metrics.score = score;

      // Save to database
      await this.saveToDatabase(symbol, metrics);

      return metrics;
    } catch (error) {
      console.error(`Failed to fetch fundamentals for ${symbol}:`, error);
      throw error;
    }
  }

  private extractMetrics(data: any): FundamentalMetrics {
    const price = data.price || {};
    const summaryDetail = data.summaryDetail || {};
    const defaultKeyStatistics = data.defaultKeyStatistics || {};
    const financialData = data.financialData || {};

    console.log('Extracting metrics from:', {
      price,
      summaryDetail,
      defaultKeyStatistics,
      financialData
    });

    return {
      valuation: {
        peRatio: summaryDetail.trailingPE || price.regularMarketPrice / financialData.revenuePerShare || null,
        pegRatio: defaultKeyStatistics.pegRatio || null,
        psRatio: summaryDetail.priceToSalesTrailing12Months || null,
        pbRatio: price.priceToBook || defaultKeyStatistics.priceToBook || null,
        evToEbitda: defaultKeyStatistics.enterpriseToEbitda || null,
        marketCap: price.marketCap || summaryDetail.marketCap || null,
      },
      profitability: {
        profitMargin: financialData.profitMargins || null,
        operatingMargin: financialData.operatingMargins || null,
        roe: financialData.returnOnEquity || null,
        roa: financialData.returnOnAssets || null,
        roic: null,
      },
      growth: {
        revenueGrowth: financialData.revenueGrowth || null,
        earningsGrowth: financialData.earningsGrowth || null,
        fcfGrowth: null,
      },
      financial: {
        currentRatio: financialData.currentRatio || null,
        quickRatio: financialData.quickRatio || null,
        debtToEquity: financialData.debtToEquity ? financialData.debtToEquity / 100 : null,
        interestCoverage: null,
      },
      dividend: {
        yield: summaryDetail.dividendYield || summaryDetail.trailingAnnualDividendYield || null,
        payoutRatio: summaryDetail.payoutRatio || null,
        growthRate: summaryDetail.fiveYearAvgDividendYield || null,
      },
      score: {
        total: 0,
        breakdown: {
          valuation: 0,
          profitability: 0,
          growth: 0,
          financial: 0,
          dividend: 0,
        },
        interpretation: '',
      },
    };
  }

  private calculateFundamentalScore(metrics: FundamentalMetrics): FundamentalMetrics['score'] {
    const breakdown = {
      valuation: 0,
      profitability: 0,
      growth: 0,
      financial: 0,
      dividend: 0,
    };

    // Valuation Score (average of available metrics)
    let valuationScores = [];
    if (metrics.valuation.peRatio !== null) {
      valuationScores.push(this.scorePE(metrics.valuation.peRatio));
    }
    if (metrics.valuation.pbRatio !== null) {
      valuationScores.push(this.scorePB(metrics.valuation.pbRatio));
    }
    if (metrics.valuation.pegRatio !== null && metrics.valuation.pegRatio > 0) {
      valuationScores.push(this.scorePEG(metrics.valuation.pegRatio));
    }
    if (metrics.valuation.evToEbitda !== null) {
      valuationScores.push(this.scoreEVToEbitda(metrics.valuation.evToEbitda));
    }
    breakdown.valuation = valuationScores.length > 0 
      ? valuationScores.reduce((a, b) => a + b, 0) / valuationScores.length 
      : 5;

    // Profitability Score (average of available metrics)
    let profitabilityScores = [];
    if (metrics.profitability.roe !== null) {
      profitabilityScores.push(this.scoreROE(metrics.profitability.roe));
    }
    if (metrics.profitability.profitMargin !== null) {
      profitabilityScores.push(this.scoreMargin(metrics.profitability.profitMargin));
    }
    if (metrics.profitability.roa !== null) {
      profitabilityScores.push(this.scoreROA(metrics.profitability.roa));
    }
    breakdown.profitability = profitabilityScores.length > 0
      ? profitabilityScores.reduce((a, b) => a + b, 0) / profitabilityScores.length
      : 5;

    // Growth Score (average of available metrics)
    let growthScores = [];
    if (metrics.growth.revenueGrowth !== null) {
      growthScores.push(this.scoreGrowth(metrics.growth.revenueGrowth));
    }
    if (metrics.growth.earningsGrowth !== null) {
      growthScores.push(this.scoreGrowth(metrics.growth.earningsGrowth));
    }
    breakdown.growth = growthScores.length > 0
      ? growthScores.reduce((a, b) => a + b, 0) / growthScores.length
      : 5;

    // Financial Health Score (average of available metrics)
    let financialScores = [];
    if (metrics.financial.currentRatio !== null) {
      financialScores.push(this.scoreCurrentRatio(metrics.financial.currentRatio));
    }
    if (metrics.financial.debtToEquity !== null) {
      financialScores.push(this.scoreDebtToEquity(metrics.financial.debtToEquity));
    }
    if (metrics.financial.quickRatio !== null) {
      financialScores.push(this.scoreQuickRatio(metrics.financial.quickRatio));
    }
    breakdown.financial = financialScores.length > 0
      ? financialScores.reduce((a, b) => a + b, 0) / financialScores.length
      : 5;

    // Dividend Score
    let dividendScores = [];
    if (metrics.dividend.yield !== null && metrics.dividend.yield > 0) {
      dividendScores.push(this.scoreDividendYield(metrics.dividend.yield));
    }
    if (metrics.dividend.payoutRatio !== null && metrics.dividend.payoutRatio > 0) {
      dividendScores.push(this.scorePayoutRatio(metrics.dividend.payoutRatio));
    }
    breakdown.dividend = dividendScores.length > 0
      ? dividendScores.reduce((a, b) => a + b, 0) / dividendScores.length
      : 0;

    // Calculate total score (weighted average)
    const weights = {
      valuation: 0.25,
      profitability: 0.25,
      growth: 0.20,
      financial: 0.20,
      dividend: 0.10
    };

    const total = 
      breakdown.valuation * weights.valuation +
      breakdown.profitability * weights.profitability +
      breakdown.growth * weights.growth +
      breakdown.financial * weights.financial +
      breakdown.dividend * weights.dividend;

    // Generate interpretation
    const interpretation = this.generateInterpretation(total, breakdown, metrics);

    return {
      total: Math.round(total * 10) / 10,
      breakdown: {
        valuation: Math.round(breakdown.valuation * 10) / 10,
        profitability: Math.round(breakdown.profitability * 10) / 10,
        growth: Math.round(breakdown.growth * 10) / 10,
        financial: Math.round(breakdown.financial * 10) / 10,
        dividend: Math.round(breakdown.dividend * 10) / 10,
      },
      interpretation,
    };
  }

  // Scoring methods
  private scorePE(pe: number): number {
    if (pe < 0) return 3;
    if (pe < 15) return 9;
    if (pe < 20) return 8;
    if (pe < 25) return 7;
    if (pe < 30) return 6;
    if (pe < 40) return 5;
    if (pe < 50) return 4;
    return 3;
  }

  private scorePB(pb: number): number {
    if (pb < 1) return 9;
    if (pb < 2) return 8;
    if (pb < 3) return 7;
    if (pb < 5) return 6;
    if (pb < 8) return 5;
    return 4;
  }

  private scorePEG(peg: number): number {
    if (peg < 0) return 3;
    if (peg < 1) return 9;
    if (peg < 1.5) return 7;
    if (peg < 2) return 5;
    return 3;
  }

  private scoreEVToEbitda(ratio: number): number {
    if (ratio < 0) return 3;
    if (ratio < 8) return 9;
    if (ratio < 12) return 7;
    if (ratio < 15) return 5;
    return 3;
  }

  private scoreROE(roe: number): number {
    if (roe > 0.25) return 9;
    if (roe > 0.20) return 8;
    if (roe > 0.15) return 7;
    if (roe > 0.10) return 6;
    if (roe > 0.05) return 5;
    if (roe > 0) return 4;
    return 3;
  }

  private scoreROA(roa: number): number {
    if (roa > 0.15) return 9;
    if (roa > 0.10) return 8;
    if (roa > 0.07) return 7;
    if (roa > 0.05) return 6;
    if (roa > 0.02) return 5;
    if (roa > 0) return 4;
    return 3;
  }

  private scoreMargin(margin: number): number {
    if (margin > 0.30) return 9;
    if (margin > 0.20) return 8;
    if (margin > 0.15) return 7;
    if (margin > 0.10) return 6;
    if (margin > 0.05) return 5;
    if (margin > 0) return 4;
    return 3;
  }

  private scoreGrowth(growth: number): number {
    if (growth > 0.30) return 9;
    if (growth > 0.20) return 8;
    if (growth > 0.15) return 7;
    if (growth > 0.10) return 6;
    if (growth > 0.05) return 5;
    if (growth > 0) return 4;
    return 3;
  }

  private scoreCurrentRatio(ratio: number): number {
    if (ratio > 2) return 9;
    if (ratio > 1.5) return 8;
    if (ratio > 1.2) return 7;
    if (ratio > 1) return 6;
    if (ratio > 0.8) return 4;
    return 3;
  }

  private scoreQuickRatio(ratio: number): number {
    if (ratio > 1.5) return 9;
    if (ratio > 1.2) return 8;
    if (ratio > 1) return 7;
    if (ratio > 0.8) return 5;
    return 3;
  }

  private scoreDebtToEquity(ratio: number): number {
    if (ratio < 0.3) return 9;
    if (ratio < 0.5) return 8;
    if (ratio < 0.8) return 7;
    if (ratio < 1) return 6;
    if (ratio < 1.5) return 5;
    if (ratio < 2) return 4;
    return 3;
  }

  private scoreDividendYield(dividendYield: number): number {
    if (dividendYield > 0.05) return 9;
    if (dividendYield > 0.04) return 8;
    if (dividendYield > 0.03) return 7;
    if (dividendYield > 0.02) return 6;
    if (dividendYield > 0.01) return 5;
    return 3;
  }

  private scorePayoutRatio(ratio: number): number {
    if (ratio < 0 || ratio > 1) return 3;
    if (ratio < 0.4) return 9;
    if (ratio < 0.5) return 8;
    if (ratio < 0.6) return 7;
    if (ratio < 0.7) return 6;
    if (ratio < 0.8) return 5;
    return 3;
  }

  private generateInterpretation(
    total: number,
    breakdown: any,
    metrics: FundamentalMetrics
  ): string {
    if (total >= 7) {
      return "Strong fundamentals across multiple metrics. The company shows solid profitability, reasonable valuation, and healthy financial position.";
    } else if (total >= 5) {
      return "Mixed fundamentals with some strong points. Consider analyzing specific areas of concern before making investment decisions.";
    } else {
      return "Weak fundamentals detected. The company may face challenges in profitability, growth, or financial health. Proceed with caution.";
    }
  }

  private async saveToDatabase(symbol: string, metrics: FundamentalMetrics) {
    await prisma.fundamentalData.upsert({
      where: { symbol },
      update: {
        peRatio: metrics.valuation.peRatio,
        pegRatio: metrics.valuation.pegRatio,
        psRatio: metrics.valuation.psRatio,
        pbRatio: metrics.valuation.pbRatio,
        evToEbitda: metrics.valuation.evToEbitda,
        marketCap: metrics.valuation.marketCap,
        profitMargin: metrics.profitability.profitMargin,
        operatingMargin: metrics.profitability.operatingMargin,
        roe: metrics.profitability.roe,
        roa: metrics.profitability.roa,
        roic: metrics.profitability.roic,
        revenueGrowth: metrics.growth.revenueGrowth,
        earningsGrowth: metrics.growth.earningsGrowth,
        fcfGrowth: metrics.growth.fcfGrowth,
        currentRatio: metrics.financial.currentRatio,
        quickRatio: metrics.financial.quickRatio,
        debtToEquity: metrics.financial.debtToEquity,
        dividendYield: metrics.dividend.yield,
        payoutRatio: metrics.dividend.payoutRatio,
        dividendGrowth: metrics.dividend.growthRate,
        fundamentalScore: metrics.score.total,
        scoreDetails: metrics.score as any,
        lastUpdated: new Date(),
      },
      create: {
        symbol,
        peRatio: metrics.valuation.peRatio,
        pegRatio: metrics.valuation.pegRatio,
        psRatio: metrics.valuation.psRatio,
        pbRatio: metrics.valuation.pbRatio,
        evToEbitda: metrics.valuation.evToEbitda,
        marketCap: metrics.valuation.marketCap,
        profitMargin: metrics.profitability.profitMargin,
        operatingMargin: metrics.profitability.operatingMargin,
        roe: metrics.profitability.roe,
        roa: metrics.profitability.roa,
        roic: metrics.profitability.roic,
        revenueGrowth: metrics.growth.revenueGrowth,
        earningsGrowth: metrics.growth.earningsGrowth,
        fcfGrowth: metrics.growth.fcfGrowth,
        currentRatio: metrics.financial.currentRatio,
        quickRatio: metrics.financial.quickRatio,
        debtToEquity: metrics.financial.debtToEquity,
        dividendYield: metrics.dividend.yield,
        payoutRatio: metrics.dividend.payoutRatio,
        dividendGrowth: metrics.dividend.growthRate,
        fundamentalScore: metrics.score.total,
        scoreDetails: metrics.score as any,
      },
    });
  }

  private formatCachedData(cached: any): FundamentalMetrics {
    const score = cached.scoreDetails || { 
      total: 5, 
      breakdown: {
        valuation: 5,
        profitability: 5,
        growth: 5,
        financial: 5,
        dividend: 0
      }, 
      interpretation: 'No analysis available' 
    };
    
    return {
      valuation: {
        peRatio: cached.peRatio,
        pegRatio: cached.pegRatio,
        psRatio: cached.psRatio,
        pbRatio: cached.pbRatio,
        evToEbitda: cached.evToEbitda,
        marketCap: cached.marketCap,
      },
      profitability: {
        profitMargin: cached.profitMargin,
        operatingMargin: cached.operatingMargin,
        roe: cached.roe,
        roa: cached.roa,
        roic: cached.roic,
      },
      growth: {
        revenueGrowth: cached.revenueGrowth,
        earningsGrowth: cached.earningsGrowth,
        fcfGrowth: cached.fcfGrowth,
      },
      financial: {
        currentRatio: cached.currentRatio,
        quickRatio: cached.quickRatio,
        debtToEquity: cached.debtToEquity,
        interestCoverage: cached.interestCoverage,
      },
      dividend: {
        yield: cached.dividendYield,
        payoutRatio: cached.payoutRatio,
        growthRate: cached.dividendGrowth,
      },
      score,
    };
  }
}

export const fundamentalAnalysisService = new FundamentalAnalysisService();