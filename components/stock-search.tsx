"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by symbol or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <Card className="absolute z-50 mt-2 w-full max-h-[300px] overflow-y-auto">
          {error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : isLoading && results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching stocks...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              {query ? "No stocks found" : "Start typing to search"}
            </div>
          ) : (
            <div className="py-1">
              {results.map((stock, index) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className={cn(
                    "w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center",
                    index !== results.length - 1 && "border-b"
                  )}
                >
                  <div>
                    <div className="font-medium">{stock.symbol}</div>
                    <div className="text-sm text-gray-600">
                      {stock.name}
                      {stock.exchange && (
                        <span className="ml-2 text-xs text-gray-500">
                          {stock.exchange}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {stock.price > 0 ? formatCurrency(stock.price, stock.currency) : "Loading..."}
                    </div>
                    {stock.price > 0 && (
                      <div className={cn(
                        "text-sm",
                        stock.change >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatPercent(stock.changePercent)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-4 py-2 text-xs text-gray-500 border-t">
                Data provided by Yahoo Finance
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}