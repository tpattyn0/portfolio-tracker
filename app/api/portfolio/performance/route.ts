import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPortfolio } from "@/lib/utils/auth";
import { prisma } from "@/lib/prisma";
import { marketDataService } from "@/lib/services/market-data.service";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { subDays, startOfYear } from "date-fns";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "FROM_START";

type Interval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';

function getRangeWindow(range: Range, earliestTxDate?: Date): { start: Date; end: Date; interval: Interval; key: 'datetime' | 'date' } {
  const end = new Date();
  switch (range) {
    case "1D":
      return { start: subDays(end, 1), end, interval: '5m', key: 'datetime' };
    case "1W":
      return { start: subDays(end, 7), end, interval: '30m', key: 'datetime' };
    case "1M":
      return { start: subDays(end, 30), end, interval: '1d', key: 'date' };
    case "3M":
      return { start: subDays(end, 90), end, interval: '1d', key: 'date' };
    case "6M":
      return { start: subDays(end, 180), end, interval: '1d', key: 'date' };
    case "YTD":
      return { start: startOfYear(end), end, interval: '1d', key: 'date' };
    case "1Y":
      return { start: subDays(end, 365), end, interval: '1wk', key: 'date' };
    case "5Y":
      return { start: subDays(end, 365 * 5), end, interval: '1mo', key: 'date' };
    case "10Y":
      return { start: subDays(end, 365 * 10), end, interval: '1mo', key: 'date' };
    case "FROM_START":
      if (!earliestTxDate) return { start: subDays(end, 30), end, interval: '1d', key: 'date' };
      return { start: earliestTxDate, end, interval: '1mo', key: 'date' };
    default:
      return { start: subDays(end, 30), end, interval: '1d', key: 'date' };
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserWithPortfolio();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const range = (searchParams.get('range') || '1M').toUpperCase() as Range;
    const requestedBaseCurrency = searchParams.get('baseCurrency');

    // Fetch user's transactions and positions
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: auth.userId },
      include: {
        positions: true,
        transactions: { orderBy: { executedAt: 'asc' } },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ series: [] });
    }

    // Get base currency for conversion
    const baseCurrency = requestedBaseCurrency || portfolio.baseCurrency || 'EUR';

    const transactions = portfolio.transactions.map(tx => ({
      ticker: tx.ticker,
      type: tx.type,
      executedAt: tx.executedAt,
      quantity: tx.quantity.toNumber(),
    }));

    const symbolsSet = new Set<string>();
    for (const tx of transactions) symbolsSet.add(tx.ticker);
    for (const pos of portfolio.positions) symbolsSet.add(pos.ticker);
    const symbols = Array.from(symbolsSet);

    // Get currency for each position and fetch exchange rates
    const symbolCurrency = new Map<string, string>();
    const exchangeRates = new Map<string, number>();

    for (const pos of portfolio.positions) {
      symbolCurrency.set(pos.ticker, pos.currency);

      // Get exchange rate if currency differs from base
      if (pos.currency !== baseCurrency) {
        try {
          const rate = await exchangeRateService.getRate(pos.currency, baseCurrency);
          exchangeRates.set(pos.currency, rate);
        } catch (error) {
          console.error(`Failed to get rate ${pos.currency} -> ${baseCurrency}:`, error);
          exchangeRates.set(pos.currency, 1); // Fallback to 1:1
        }
      } else {
        exchangeRates.set(pos.currency, 1);
      }
    }

    const earliestTx = transactions.length > 0 ? transactions[0].executedAt : undefined;
    const { start, end, interval, key } = getRangeWindow(range, earliestTx);

    // Build holding timelines per symbol (cumulative quantity over time)
    const txBySymbol = new Map<string, { date: Date; qtyDelta: number }[]>();
    for (const sym of symbols) txBySymbol.set(sym, []);
    for (const tx of transactions) {
      const arr = txBySymbol.get(tx.ticker)!;
      const delta = tx.type === 'BUY' ? tx.quantity : -tx.quantity;
      arr.push({ date: tx.executedAt, qtyDelta: delta });
    }
    for (const [sym, arr] of Array.from(txBySymbol)) {
      arr.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    // Fetch historical prices per symbol
    const priceBySymbol = new Map<string, { date: string; value: number }[]>();
    // For intraday, extend fetch window backward so we can forward-fill from prior sessions (use 5 days to cover weekends/holidays)
    const fetchStart = key === 'datetime' ? subDays(start, 5) : start;

    await Promise.all(symbols.map(async (sym) => {
      const data = await marketDataService.getHistoricalRange(sym, fetchStart, end, interval);
      if (key === 'date') {
        // Collapse to day/month buckets: normalize to YYYY-MM-DD
        const byKey = new Map<string, { sum: number; count: number }>();
        for (const p of data) {
          const d = new Date(p.date);
          const k = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
          const cur = byKey.get(k) || { sum: 0, count: 0 };
          byKey.set(k, { sum: cur.sum + p.value, count: cur.count + 1 });
        }
        const collapsed = Array.from(byKey.entries())
          .map(([k, v]) => ({ date: k, value: v.sum / v.count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        priceBySymbol.set(sym, collapsed);
      } else {
        const sorted = data
          .map(d => ({ date: d.date, value: d.value }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Clip to original [start, end]
        const clipped = sorted.filter(p => new Date(p.date).getTime() >= start.getTime() && new Date(p.date).getTime() <= end.getTime());
        // Keep one prior point (last < start) if available to seed forward-fill
        const lastBeforeIdx = (() => {
          let idx = -1;
          for (let i = 0; i < sorted.length; i++) {
            const t = new Date(sorted[i].date).getTime();
            if (t < start.getTime()) idx = i; else break;
          }
          return idx;
        })();
        if (lastBeforeIdx >= 0) {
          const seedPoint = sorted[lastBeforeIdx];
          if (clipped.length === 0 || new Date(clipped[0].date).getTime() !== new Date(seedPoint.date).getTime()) {
            clipped.unshift(seedPoint);
          }
        }
        priceBySymbol.set(sym, clipped);
      }
    }));

    // Build union timeline across all symbols (filtered to [start, end])
    const timelineSet = new Set<string>();
    for (const arr of Array.from(priceBySymbol.values())) {
      for (const p of arr) {
        const t = new Date(p.date).getTime();
        if (t >= start.getTime() && t <= end.getTime()) timelineSet.add(p.date);
      }
    }
    const timeline = Array.from(timelineSet).sort();

    // For each symbol, compute cumulative quantity at each timestamp using two-pointer
    const qtyAtSymbolTime = new Map<string, number[]>();
    for (const sym of symbols) {
      const txs = txBySymbol.get(sym) || [];
      let idx = 0;
      let cum = 0;
      const q: number[] = new Array(timeline.length).fill(0);
      for (let i = 0; i < timeline.length; i++) {
        const t = new Date(timeline[i]).getTime();
        while (idx < txs.length && txs[idx].date.getTime() <= t) {
          cum += txs[idx].qtyDelta;
          idx++;
        }
        q[i] = cum;
      }
      qtyAtSymbolTime.set(sym, q);
    }

    // Precompute forward-filled price indices per symbol
    const priceIdx: Record<string, number> = {};
    const lastPrice: Record<string, number> = {};
    for (const sym of symbols) {
      priceIdx[sym] = 0;
      lastPrice[sym] = 0;
    }

    // Build the series, forward-filling last known price for each symbol
    const series = timeline.map((ts, i) => {
      let total = 0;
      for (const sym of symbols) {
        const prices = priceBySymbol.get(sym) || [];
        const qtyArr = qtyAtSymbolTime.get(sym) || [];
        // Advance pointer while next price timestamp <= current ts
        while (priceIdx[sym] < prices.length && new Date(prices[priceIdx[sym]].date).getTime() <= new Date(ts).getTime()) {
          const v = prices[priceIdx[sym]].value;
          if (typeof v === 'number' && isFinite(v) && v > 0) {
            lastPrice[sym] = v;
          }
          priceIdx[sym]++;
        }
        const qty = qtyArr[i] || 0;
        if (qty > 0 && lastPrice[sym] > 0) {
          // Apply exchange rate conversion
          const currency = symbolCurrency.get(sym) || baseCurrency;
          const rate = exchangeRates.get(currency) || 1;
          total += qty * lastPrice[sym] * rate;
        }
      }
      return { date: ts, value: total };
    });

    return NextResponse.json({ range, start, end, interval, series });
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json({ error: 'Failed to compute portfolio performance' }, { status: 500 });
  }
}
