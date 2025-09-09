import yahooFinance from 'yahoo-finance2';
import { addDays, subDays, startOfDay } from 'date-fns';

interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  marketCap?: number;
  currency: string;
  exchange: string;
  lastUpdated: Date;
}

interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

interface ChartData {
  date: string;
  value: number;
  volume: number;
}

export class MarketDataService {
  // Cache for reducing API calls
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_DURATION = 60000; // 1 minute

  async getQuote(symbol: string): Promise<MarketQuote> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const quote = await yahooFinance.quoteSummary(symbol, {
        modules: ['price']
      });

      // Add null checks for TypeScript
      if (!quote || !quote.price) {
        throw new Error(`No price data available for ${symbol}`);
      }

      const priceData = quote.price;
      
      const marketQuote: MarketQuote = {
        symbol: priceData.symbol || symbol,
        name: priceData.longName || priceData.shortName || symbol,
        price: priceData.regularMarketPrice || 0,
        change: priceData.regularMarketChange || 0,
        changePercent: priceData.regularMarketChangePercent || 0,
        high: priceData.regularMarketDayHigh || 0,
        low: priceData.regularMarketDayLow || 0,
        open: priceData.regularMarketOpen || 0,
        previousClose: priceData.regularMarketPreviousClose || 0,
        volume: priceData.regularMarketVolume || 0,
        marketCap: priceData.marketCap || undefined,
        currency: priceData.currency || 'USD',
        exchange: priceData.exchange || '',
        lastUpdated: new Date()
      };

      this.setCache(cacheKey, marketQuote);
      return marketQuote;
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error);
      throw new Error(`Failed to fetch market data for ${symbol}`);
    }
  }

  async getHistoricalData(
    symbol: string, 
    period: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' = '1M'
    ): Promise<ChartData[]> {
    const cacheKey = `history:${symbol}:${period}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const endDate = new Date();
        let startDate: Date;
        let interval: '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo' = '1d';

        switch (period) {
        case '1D':
            startDate = subDays(endDate, 1);
            interval = '5m'; // 5-minute intervals for intraday
            break;
        case '1W':
            startDate = subDays(endDate, 7);
            interval = '30m'; // 30-minute intervals for week
            break;
        case '1M':
            startDate = subDays(endDate, 30);
            interval = '1d'; // Daily for month
            break;
        case '3M':
            startDate = subDays(endDate, 90);
            interval = '1d'; // Daily for 3 months
            break;
        case '6M':
            startDate = subDays(endDate, 180);
            interval = '1d'; // Daily for 6 months
            break;
        case '1Y':
            startDate = subDays(endDate, 365);
            interval = '1wk'; // Weekly for 1 year
            break;
        case '5Y':
            startDate = subDays(endDate, 365 * 5);
            interval = '1mo'; // Monthly for 5 years
            break;
        default:
            startDate = subDays(endDate, 30);
            interval = '1d';
        }

        const queryOptions = {
        period1: startDate,
        period2: endDate,
        interval: interval as any
        };

        const result = await yahooFinance.chart(symbol, queryOptions);
        
        if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error(`No historical data available for ${symbol}`);
        }

        const chartData: ChartData[] = result.quotes
        .filter(quote => quote.date && (quote.close !== null || quote.adjclose !== null))
        .map(quote => ({
            date: quote.date!.toISOString(),
            value: quote.close ?? quote.adjclose ?? 0,
            volume: quote.volume || 0
        }));

        this.setCache(cacheKey, chartData);
        return chartData;
    } catch (error) {
        console.error(`Failed to fetch historical data for ${symbol}:`, error);
        throw new Error(`Failed to fetch historical data for ${symbol}`);
    }
  }


  async searchSymbols(query: string): Promise<Array<{
    symbol: string;
    name: string;
    exchange: string;
    type: string;
  }>> {
    if (!query || query.length < 1) return [];

    try {
      const results = await yahooFinance.search(query, {
        quotesCount: 10,
        newsCount: 0
      });

      if (!results || !results.quotes) {
        return [];
      }

      return results.quotes
        .filter(q => q.isYahooFinance && (q.typeDisp === 'Equity' || q.typeDisp === 'ETF'))
        .map(q => ({
          symbol: q.symbol || '',
          name: q.longname || q.shortname || q.symbol || '',
          exchange: q.exchange || '',
          type: q.typeDisp || 'Equity'
        }));
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  // Cache helpers
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export const marketDataService = new MarketDataService();