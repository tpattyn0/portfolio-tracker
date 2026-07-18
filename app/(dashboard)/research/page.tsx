"use client";

import { useRouter } from "next/navigation";
import { StockSearch } from "@/components/stock-search";

const popularStocks = [
  { symbol: "AAPL", name: "Apple", change: 1.24 },
  { symbol: "MSFT", name: "Microsoft", change: 0.87 },
  { symbol: "GOOGL", name: "Alphabet", change: 1.1 },
  { symbol: "AMZN", name: "Amazon", change: 0.62 },
  { symbol: "NVDA", name: "NVIDIA", change: 2.05 },
  { symbol: "TSLA", name: "Tesla", change: -0.44 },
];

const disciplines = [
  {
    title: "Technical analysis",
    description: "Moving averages, RSI, MACD and momentum indicators to time entries and exits.",
  },
  {
    title: "Fundamental analysis",
    description: "Revenue growth, margins, balance-sheet strength and valuation multiples.",
  },
  {
    title: "Intrinsic value",
    description: "Discounted cash-flow models estimating what a business is truly worth.",
  },
];

export default function ResearchPage() {
  const router = useRouter();

  return (
    <div>
      <div className="mx-auto max-w-[720px] pt-9 text-center">
        <div className="text-[11px] uppercase tracking-[0.14em] text-mut">
          The research desk
        </div>
        <h1 className="mt-2.5 font-serif text-[52px] font-medium leading-[1.05]">
          Know what you own
        </h1>
        <p className="mb-7 mt-3 font-serif text-base italic text-mut">
          Fundamentals, technicals &amp; intrinsic value — before the market opens.
        </p>
        <StockSearch onSelect={(stock) => router.push(`/research/${stock.symbol}`)} />
      </div>

      <div className="mt-14 rounded-lg border border-border bg-card px-7 py-6">
        <div className="flex items-center justify-between border-b border-line2 pb-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Popular this week
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-mut">
            Most researched by Meridian readers
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
          {popularStocks.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => router.push(`/research/${stock.symbol}`)}
              className="flex items-center justify-between border-b border-line2 px-3 py-4 text-left hover:bg-fill"
            >
              <span>
                <span className="block font-serif text-base font-medium">{stock.name}</span>
                <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                  {stock.symbol}
                </span>
              </span>
              <span className={stock.change >= 0 ? "text-[13px] text-up" : "text-[13px] text-dn"}>
                {stock.change >= 0 ? "▲" : "▼"} {stock.change >= 0 && "+"}
                {stock.change.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {disciplines.map((d) => (
          <div key={d.title} className="rounded-lg border border-border bg-card px-7 py-6">
            <div className="font-serif text-xl">{d.title}</div>
            <p className="mt-2 text-sm leading-[1.6] text-sub">{d.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
