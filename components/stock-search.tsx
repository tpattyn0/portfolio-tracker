"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import debounce from "lodash.debounce";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange?: string;
  type?: string;
}

interface StockSearchProps {
  onSelect: (stock: Stock) => void;
}

export function StockSearch({ onSelect }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchStocks = async (searchQuery: string) => {
    if (searchQuery.length < 1) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }
      
      setResults(data.results || []);
      setIsOpen(true);
    } catch (error) {
      console.error("Search error:", error);
      setError("Failed to search stocks. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((query: string) => searchStocks(query), 300),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleSelect = (stock: Stock) => {
    onSelect(stock);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" />
        <input
          type="text"
          placeholder="Search by ticker or company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          className="w-full rounded-[28px] border border-border bg-card px-7 py-4 pl-12 text-center font-serif text-xl text-foreground outline-none placeholder:text-mut"
        />
        {isLoading && (
          <Loader2 className="absolute right-7 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-mut" />
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <div className="absolute z-50 mt-2 max-h-[300px] w-full overflow-y-auto rounded-lg border border-border bg-card text-left">
          {error ? (
            <div className="p-4 text-sm text-dn">{error}</div>
          ) : isLoading && results.length === 0 ? (
            <div className="flex items-center p-4 text-sm text-mut">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching stocks…
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-mut">
              {query ? "No stocks found" : "Start typing to search"}
            </div>
          ) : (
            <div className="py-1">
              {results.map((stock, index) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left hover:bg-fill",
                    index !== results.length - 1 && "border-b border-line2"
                  )}
                >
                  <div>
                    <div className="font-medium">{stock.symbol}</div>
                    <div className="text-sm text-sub">
                      {stock.name}
                      {stock.exchange && (
                        <span className="ml-2 text-xs text-mut">{stock.exchange}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {stock.price > 0 ? formatCurrency(stock.price, stock.currency) : "Loading..."}
                    </div>
                    {stock.price > 0 && (
                      <div className={cn("text-sm", stock.change >= 0 ? "text-up" : "text-dn")}>
                        {formatPercent(stock.changePercent)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              <div className="border-t border-line2 px-4 py-2 text-xs text-mut">
                Data provided by Yahoo Finance
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}