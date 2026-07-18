import { safeQuoteSummary } from '@/lib/yahoo-finance';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface AnalystRatings {
  targetPrice: number | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  averageRating: number | null;
  lastUpdated: string;
}

interface FundamentalMetrics {
  valuation: {
    peRatio: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    psRatio: number | null;
    pbRatio: number | null;
    pfcfRatio: number | null;
    evToEbitda: number | null;
    enterpriseValue: number | null;
    marketCap: number | null;
    eps: number | null;
    forwardEps: number | null;
    bookValue: number | null;
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

      // Force refresh for old data - check if cache is older than when we improved calculations
      // Or if cache doesn't have forward PE/PEG calculated yet
      const latestMigrationDate = new Date('2025-10-14'); // Date when we added forward PE and improved PEG
      const isCacheFresh = cached && cached.lastUpdated > latestMigrationDate;
      const isWithin24Hours = cached && cached.lastUpdated > new Date(Date.now() - 24 * 60 * 60 * 1000);


      // Only use cache if it's fresh AND within 24 hours
      if (cached && isCacheFresh && isWithin24Hours) {
        return this.formatCachedData(cached);
      }


      // Fetch fresh data from Yahoo Finance
      const quoteSummary = await safeQuoteSummary(symbol, {
        modules: [
          'price',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'cashflowStatementHistory',
          'earningsHistory',
          'earningsTrend',
          'upgradeDowngradeHistory',
          'recommendationTrend'
        ]
      });

      // The minimum needed for any valuation metric is the `price` or
      // `summaryDetail` module. If neither is present (e.g. Yahoo schema
      // drift coerced everything away), do not persist/cache an all-null
      // row scored as a misleading neutral 5 — fail loud instead.
      if (!quoteSummary || (!quoteSummary.price && !quoteSummary.summaryDetail)) {
        throw new Error(`No usable fundamentals data available for ${symbol}`);
      }

      // Extract metrics and analyst ratings
      const metrics = this.extractMetrics(quoteSummary);

      // Calculate scores
      const score = this.calculateFundamentalScore(metrics);

      // Create the complete metrics object with score
      const completeMetrics: FundamentalMetrics = {
        ...metrics,
        score
      };

      // Save to database
      await this.saveToDatabase(symbol, completeMetrics);

      return completeMetrics;
    } catch (error) {
      console.error(`Failed to fetch fundamentals for ${symbol}:`, error);
      throw error;
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractMetrics(data: Record<string, any>): Omit<FundamentalMetrics, 'score'> {
    const price = data.price || {};
    const summaryDetail = data.summaryDetail || {};
    const defaultKeyStatistics = data.defaultKeyStatistics || {};
    const financialData = data.financialData || {};
    const earningsTrend = data.earningsTrend?.trend?.[0]?.earningsEstimate;


    // Calculate EPS (Earnings Per Share)
    const trailingEps = defaultKeyStatistics.trailingEps;
    const forwardEps = defaultKeyStatistics.forwardEps || null;
    const eps = trailingEps || forwardEps || null;

    // Calculate Book Value
    const bookValue = defaultKeyStatistics.bookValue || null;

    // Calculate Forward P/E
    const currentPrice = price.regularMarketPrice || summaryDetail.regularMarketPrice || null;
    const forwardPE = summaryDetail.forwardPE ||
      (currentPrice && forwardEps && forwardEps > 0 ? currentPrice / forwardEps : null);

    // Calculate P/FCF (Price to Free Cash Flow)
    // Try multiple sources for free cash flow data
    const freeCashFlow = financialData.freeCashflow ||
      financialData.operatingCashflow ||
      null;
    const marketCap = price.marketCap || summaryDetail.marketCap || null;


    const pfcfRatio = (marketCap && freeCashFlow && freeCashFlow > 0)
      ? marketCap / freeCashFlow
      : null;


    // Calculate P/E Ratio
    const peRatio = summaryDetail.trailingPE || (price.regularMarketPrice && eps ? price.regularMarketPrice / eps : null);

    // Calculate PEG Ratio
    // PEG = P/E / (Earnings Growth Rate * 100)
    // Try to get it from Yahoo first, otherwise calculate it
    let pegRatio = defaultKeyStatistics.pegRatio || null;

    if (!pegRatio && peRatio && financialData.earningsGrowth) {
      const earningsGrowthPercent = financialData.earningsGrowth * 100; // Convert to percentage
      if (earningsGrowthPercent > 0 && peRatio > 0) {
        pegRatio = peRatio / earningsGrowthPercent;
      }
    }

    return {
      valuation: {
        peRatio,
        forwardPE,
        pegRatio,
        psRatio: summaryDetail.priceToSalesTrailing12Months || null,
        pbRatio: price.priceToBook || defaultKeyStatistics.priceToBook || null,
        pfcfRatio,
        evToEbitda: defaultKeyStatistics.enterpriseToEbitda || null,
        enterpriseValue: defaultKeyStatistics.enterpriseValue || null,
        marketCap,
        eps,
        forwardEps,
        bookValue,
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
    };
  }


  private calculateFundamentalScore(metrics: Omit<FundamentalMetrics, 'score'>): { total: number; breakdown: { valuation: number; profitability: number; growth: number; financial: number; dividend: number; }; interpretation: string; } {
    const breakdown = {
      valuation: 0,
      profitability: 0,
      growth: 0,
      financial: 0,
      dividend: 0
    };

    // Valuation Score (weighted average of available metrics)
    // Forward-looking metrics (Forward P/E, PEG, P/FCF) are weighted higher as they are more reliable
    const valuationScores: { score: number; weight: number }[] = [];

    // Prefer forward P/E over trailing P/E
    if (metrics.valuation.forwardPE !== null && metrics.valuation.forwardPE > 0) {
      valuationScores.push({ score: this.scoreForwardPE(metrics.valuation.forwardPE), weight: 1.5 });
    } else if (metrics.valuation.peRatio !== null) {
      valuationScores.push({ score: this.scorePE(metrics.valuation.peRatio), weight: 1 });
    }
    if (metrics.valuation.pbRatio !== null) {
      valuationScores.push({ score: this.scorePB(metrics.valuation.pbRatio), weight: 1 });
    }
    if (metrics.valuation.pegRatio !== null && metrics.valuation.pegRatio > 0) {
      valuationScores.push({ score: this.scorePEG(metrics.valuation.pegRatio), weight: 1.5 });
    }
    if (metrics.valuation.psRatio !== null && metrics.valuation.psRatio > 0) {
      valuationScores.push({ score: this.scorePS(metrics.valuation.psRatio), weight: 1 });
    }
    if (metrics.valuation.pfcfRatio !== null && metrics.valuation.pfcfRatio > 0) {
      valuationScores.push({ score: this.scorePFCF(metrics.valuation.pfcfRatio), weight: 1.5 });
    }
    if (metrics.valuation.evToEbitda !== null) {
      valuationScores.push({ score: this.scoreEVToEbitda(metrics.valuation.evToEbitda), weight: 1 });
    }

    breakdown.valuation = valuationScores.length > 0
      ? valuationScores.reduce((acc, item) => acc + item.score * item.weight, 0) /
      valuationScores.reduce((acc, item) => acc + item.weight, 0)
      : 5;

    // Profitability Score (average of available metrics)
    const profitabilityScores = [];
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
    const growthScores = [];
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
    const financialScores = [];
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
    const dividendScores = [];
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
      valuation: 0.3,
      profitability: 0.3,
      growth: 0.2,
      financial: 0.15,
      dividend: 0.05,
    };

    const totalScore = (
      breakdown.valuation * weights.valuation +
      breakdown.profitability * weights.profitability +
      breakdown.growth * weights.growth +
      breakdown.financial * weights.financial +
      breakdown.dividend * weights.dividend
    ) / (weights.valuation + weights.profitability + weights.growth + weights.financial + weights.dividend);

    // Generate interpretation
    const interpretation = this.generateInterpretation(totalScore, breakdown, metrics);

    return {
      total: Math.round(totalScore * 10) / 10,
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

  private scoreForwardPE(forwardPE: number): number {
    // Forward P/E scoring - slightly more optimistic thresholds as it reflects future expectations
    if (forwardPE < 0) return 3;
    if (forwardPE < 12) return 9;
    if (forwardPE < 18) return 8;
    if (forwardPE < 22) return 7;
    if (forwardPE < 28) return 6;
    if (forwardPE < 35) return 5;
    if (forwardPE < 45) return 4;
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

  private scorePS(ps: number): number {
    if (ps < 1) return 9;
    if (ps < 2) return 8;
    if (ps < 3) return 7;
    if (ps < 5) return 6;
    if (ps < 7) return 5;
    if (ps < 10) return 4;
    return 3;
  }

  private scorePFCF(pfcf: number): number {
    if (pfcf < 15) return 9;
    if (pfcf < 20) return 8;
    if (pfcf < 25) return 7;
    if (pfcf < 30) return 6;
    if (pfcf < 40) return 5;
    if (pfcf < 50) return 4;
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

  private generateInterpretation(score: number, _breakdown: FundamentalMetrics['score']['breakdown'], _metrics: Omit<FundamentalMetrics, 'score'>): string {
    if (score >= 7) {
      return "Strong fundamentals across multiple metrics. The company shows solid profitability, reasonable valuation, and healthy financial position.";
    } else if (score >= 5) {
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
        forwardPE: metrics.valuation.forwardPE,
        pegRatio: metrics.valuation.pegRatio,
        psRatio: metrics.valuation.psRatio,
        pbRatio: metrics.valuation.pbRatio,
        pfcfRatio: metrics.valuation.pfcfRatio,
        evToEbitda: metrics.valuation.evToEbitda,
        enterpriseValue: metrics.valuation.enterpriseValue,
        marketCap: metrics.valuation.marketCap,
        eps: metrics.valuation.eps,
        forwardEps: metrics.valuation.forwardEps,
        bookValue: metrics.valuation.bookValue,
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
        scoreDetails: metrics.score as unknown as Prisma.InputJsonValue,
        lastUpdated: new Date(),
      },
      create: {
        symbol,
        peRatio: metrics.valuation.peRatio,
        forwardPE: metrics.valuation.forwardPE,
        pegRatio: metrics.valuation.pegRatio,
        psRatio: metrics.valuation.psRatio,
        pbRatio: metrics.valuation.pbRatio,
        pfcfRatio: metrics.valuation.pfcfRatio,
        evToEbitda: metrics.valuation.evToEbitda,
        enterpriseValue: metrics.valuation.enterpriseValue,
        marketCap: metrics.valuation.marketCap,
        eps: metrics.valuation.eps,
        forwardEps: metrics.valuation.forwardEps,
        bookValue: metrics.valuation.bookValue,
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
        scoreDetails: metrics.score as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatCachedData(cached: Record<string, any>): FundamentalMetrics {
    // Ensure the cached data has the correct structure
    const metrics = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
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
        forwardPE: cached.forwardPE || null,
        pegRatio: cached.pegRatio,
        psRatio: cached.psRatio,
        pbRatio: cached.pbRatio,
        pfcfRatio: cached.pfcfRatio || null,
        evToEbitda: cached.evToEbitda,
        enterpriseValue: cached.enterpriseValue,
        marketCap: cached.marketCap,
        eps: cached.eps || null,
        forwardEps: cached.forwardEps || null,
        bookValue: cached.bookValue || null,
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