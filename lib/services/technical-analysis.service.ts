import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
} from 'technicalindicators';

interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: {
    value: number | null;
    signal: number | null;
    histogram: number | null;
  };
  bollingerBands?: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}

export class TechnicalAnalysisService {
  calculateIndicators(prices: number[]): TechnicalIndicators {
    console.log(`Calculating indicators for ${prices.length} price points`);
    
    // More flexible requirements
    if (!prices || prices.length < 20) {
      console.log('Not enough data for indicators, need at least 20 points');
      return this.getEmptyIndicators();
    }

    try {
      const closePrices = prices;
      const currentPrice = closePrices[closePrices.length - 1];
      
      // Calculate what we can based on available data
      const indicatorData: any = {};

      // SMA 20 (needs at least 20 points)
      if (closePrices.length >= 20) {
        const sma20Array = SMA.calculate({ period: 20, values: closePrices });
        indicatorData.sma20 = sma20Array.length > 0 ? sma20Array[sma20Array.length - 1] : null;
      } else {
        indicatorData.sma20 = null;
      }

      // SMA 50 (needs at least 50 points)
      if (closePrices.length >= 50) {
        const sma50Array = SMA.calculate({ period: 50, values: closePrices });
        indicatorData.sma50 = sma50Array.length > 0 ? sma50Array[sma50Array.length - 1] : null;
      } else {
        indicatorData.sma50 = null;
      }

      // SMA 200 (needs at least 200 points)
      if (closePrices.length >= 200) {
        const sma200Array = SMA.calculate({ period: 200, values: closePrices });
        indicatorData.sma200 = sma200Array.length > 0 ? sma200Array[sma200Array.length - 1] : null;
      } else {
        indicatorData.sma200 = null;
      }

      // EMA 12 (needs at least 12 points)
      if (closePrices.length >= 12) {
        const ema12Array = EMA.calculate({ period: 12, values: closePrices });
        indicatorData.ema12 = ema12Array.length > 0 ? ema12Array[ema12Array.length - 1] : null;
      } else {
        indicatorData.ema12 = null;
      }

      // EMA 26 (needs at least 26 points)
      if (closePrices.length >= 26) {
        const ema26Array = EMA.calculate({ period: 26, values: closePrices });
        indicatorData.ema26 = ema26Array.length > 0 ? ema26Array[ema26Array.length - 1] : null;
      } else {
        indicatorData.ema26 = null;
      }

      // RSI (needs at least 15 points for RSI 14)
      if (closePrices.length >= 15) {
        const rsiArray = RSI.calculate({ period: 14, values: closePrices });
        indicatorData.rsi14 = rsiArray.length > 0 ? rsiArray[rsiArray.length - 1] : null;
        console.log('RSI calculated:', indicatorData.rsi14);
      } else {
        indicatorData.rsi14 = null;
      }

      // MACD (needs at least 26 points)
      if (closePrices.length >= 35) { // Need extra points for signal line
        const macdArray = MACD.calculate({
          values: closePrices,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false
        });

        const lastMACD = macdArray.length > 0 ? macdArray[macdArray.length - 1] : null;
        indicatorData.macd = {
          value: lastMACD?.MACD ?? null,
          signal: lastMACD?.signal ?? null,
          histogram: lastMACD?.histogram ?? null,
        };
        console.log('MACD calculated:', indicatorData.macd);
      } else {
        indicatorData.macd = { value: null, signal: null, histogram: null };
      }

      // Bollinger Bands (needs at least 20 points)
      if (closePrices.length >= 20) {
        const bbArray = BollingerBands.calculate({
          period: 20,
          values: closePrices,
          stdDev: 2
        });

        const lastBB = bbArray.length > 0 ? bbArray[bbArray.length - 1] : null;
        if (lastBB) {
          indicatorData.bollingerBands = {
            upper: lastBB.upper,
            middle: lastBB.middle,
            lower: lastBB.lower,
          };
        }
      }

      // Generate signal
      const signal = this.generateSignal(currentPrice, indicatorData);
      
      console.log('Final signal:', signal);
      console.log('Indicators summary:', {
        sma20: indicatorData.sma20 !== null,
        sma50: indicatorData.sma50 !== null,
        sma200: indicatorData.sma200 !== null,
        rsi14: indicatorData.rsi14,
        macd: indicatorData.macd.value !== null,
      });
      
      return {
        ...indicatorData,
        signal
      };
    } catch (error) {
      console.error('Technical analysis calculation error:', error);
      return this.getEmptyIndicators();
    }
  }

  private generateSignal(
    currentPrice: number,
    indicators: Omit<TechnicalIndicators, 'signal'>
  ): TechnicalIndicators['signal'] {
    let bullishPoints = 0;
    let bearishPoints = 0;
    let totalWeight = 0;

    console.log('Generating signal for price:', currentPrice);

    // Moving average analysis (weight: 3 each)
    if (indicators.sma20 !== null && indicators.sma20 !== undefined) {
      const weight = 3;
      totalWeight += weight;
      if (currentPrice > indicators.sma20) {
        bullishPoints += weight;
        console.log(`Price above SMA20: +${weight} bullish`);
      } else {
        bearishPoints += weight;
        console.log(`Price below SMA20: +${weight} bearish`);
      }
    }

    if (indicators.sma50 !== null && indicators.sma50 !== undefined) {
      const weight = 3;
      totalWeight += weight;
      if (currentPrice > indicators.sma50) {
        bullishPoints += weight;
        console.log(`Price above SMA50: +${weight} bullish`);
      } else {
        bearishPoints += weight;
        console.log(`Price below SMA50: +${weight} bearish`);
      }
    }

    if (indicators.sma200 !== null && indicators.sma200 !== undefined) {
      const weight = 2;
      totalWeight += weight;
      if (currentPrice > indicators.sma200) {
        bullishPoints += weight;
        console.log(`Price above SMA200: +${weight} bullish`);
      } else {
        bearishPoints += weight;
        console.log(`Price below SMA200: +${weight} bearish`);
      }
    }
    
    // Golden cross/death cross (weight: 4)
    if (indicators.sma50 !== null && indicators.sma200 !== null) {
      const weight = 4;
      totalWeight += weight;
      if (indicators.sma50 > indicators.sma200) {
        bullishPoints += weight;
        console.log(`Golden Cross: +${weight} bullish`);
      } else {
        bearishPoints += weight;
        console.log(`Death Cross: +${weight} bearish`);
      }
    }

    // RSI analysis (weight: 5)
    if (indicators.rsi14 !== null && indicators.rsi14 !== undefined) {
      const weight = 5;
      totalWeight += weight;
      if (indicators.rsi14 < 30) {
        bullishPoints += weight; // Oversold
        console.log(`RSI oversold (${indicators.rsi14}): +${weight} bullish`);
      } else if (indicators.rsi14 > 70) {
        bearishPoints += weight; // Overbought
        console.log(`RSI overbought (${indicators.rsi14}): +${weight} bearish`);
      } else if (indicators.rsi14 > 50) {
        bullishPoints += weight * 0.5;
        console.log(`RSI above 50 (${indicators.rsi14}): +${weight * 0.5} bullish`);
      } else {
        bearishPoints += weight * 0.5;
        console.log(`RSI below 50 (${indicators.rsi14}): +${weight * 0.5} bearish`);
      }
    }

    // MACD analysis (weight: 4)
    if (indicators.macd.value !== null && indicators.macd.signal !== null) {
      const weight = 4;
      totalWeight += weight;
      if (indicators.macd.value > indicators.macd.signal) {
        bullishPoints += weight;
        console.log(`MACD above signal: +${weight} bullish`);
      } else {
        bearishPoints += weight;
        console.log(`MACD below signal: +${weight} bearish`);
      }

      // MACD histogram momentum
      if (indicators.macd.histogram !== null) {
        const histWeight = 2;
        totalWeight += histWeight;
        if (indicators.macd.histogram > 0) {
          bullishPoints += histWeight;
          console.log(`MACD histogram positive: +${histWeight} bullish`);
        } else {
          bearishPoints += histWeight;
          console.log(`MACD histogram negative: +${histWeight} bearish`);
        }
      }
    }

    // Calculate final score
    if (totalWeight === 0) {
      console.log('No indicators available, defaulting to HOLD');
      return 'HOLD';
    }

    const netScore = (bullishPoints - bearishPoints) / totalWeight;
    console.log(`Score calculation: bullish=${bullishPoints}, bearish=${bearishPoints}, total_weight=${totalWeight}, net_score=${netScore}`);

    // Generate signal based on net score
    if (netScore >= 0.6) return 'STRONG_BUY';
    if (netScore >= 0.2) return 'BUY';
    if (netScore >= -0.2) return 'HOLD';
    if (netScore >= -0.6) return 'SELL';
    return 'STRONG_SELL';
  }

  private getEmptyIndicators(): TechnicalIndicators {
    return {
      sma20: null,
      sma50: null,
      sma200: null,
      ema12: null,
      ema26: null,
      rsi14: null,
      macd: { value: null, signal: null, histogram: null },
      signal: 'HOLD',
    };
  }
}

export const technicalAnalysisService = new TechnicalAnalysisService();