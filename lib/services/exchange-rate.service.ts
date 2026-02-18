interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface CachedRates {
  data: ExchangeRates;
  timestamp: number;
}

export class ExchangeRateService {
  private cache: Map<string, CachedRates> = new Map();
  private CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get exchange rates for a base currency
   * Uses exchangerate-api.com free tier (1,500 requests/month)
   * Caches results for 24 hours
   */
  async getExchangeRates(baseCurrency: string = 'EUR'): Promise<ExchangeRates> {
    const cacheKey = `rates:${baseCurrency}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Using exchangerate-api.com free tier
      // Note: For production, you may want to use a paid service with higher limits
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }

      const data: ExchangeRates = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);

      // If we have cached data (even if expired), return it as fallback
      if (cached) {
        return cached.data;
      }

      // If no cache available, throw error
      throw new Error('Failed to fetch exchange rates and no cache available');
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      // Get rates with fromCurrency as base
      const rates = await this.getExchangeRates(fromCurrency);

      if (!rates.rates[toCurrency]) {
        throw new Error(`Exchange rate not found for ${toCurrency}`);
      }

      return amount * rates.rates[toCurrency];
    } catch (error) {
      console.error(`Conversion error from ${fromCurrency} to ${toCurrency}:`, error);
      // Return original amount as fallback
      return amount;
    }
  }

  /**
   * Get the exchange rate between two currencies
   */
  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const rates = await this.getExchangeRates(fromCurrency);
    return rates.rates[toCurrency] || 1;
  }

  /**
   * Get current date of exchange rates
   */
  async getRatesDate(baseCurrency: string = 'EUR'): Promise<string> {
    const rates = await this.getExchangeRates(baseCurrency);
    return rates.date;
  }

  /**
   * Clear the cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const exchangeRateService = new ExchangeRateService();
