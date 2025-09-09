import { NextRequest, NextResponse } from "next/server";
import { marketDataService } from "@/lib/services/market-data.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // Use Yahoo Finance search
    const searchResults = await marketDataService.searchSymbols(query);
    
    // Get quotes for each result to get current prices
    const resultsWithPrices = await Promise.all(
      searchResults.slice(0, 5).map(async (result) => {
        try {
          const quote = await marketDataService.getQuote(result.symbol);
          return {
            symbol: result.symbol,
            name: result.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            exchange: result.exchange,
            type: result.type
          };
        } catch (error) {
          // If quote fails, return search result without price
          return {
            symbol: result.symbol,
            name: result.name,
            price: 0,
            change: 0,
            changePercent: 0,
            exchange: result.exchange,
            type: result.type
          };
        }
      })
    );

    return NextResponse.json({ results: resultsWithPrices });
  } catch (error) {
    console.error("Search error:", error);
    
    // Fallback to mock data if Yahoo Finance fails
    const mockStocks = [
      { symbol: "AAPL", name: "Apple Inc.", price: 175.43, change: 2.15, changePercent: 1.24 },
      { symbol: "MSFT", name: "Microsoft Corporation", price: 380.52, change: -1.48, changePercent: -0.39 },
      { symbol: "GOOGL", name: "Alphabet Inc.", price: 142.65, change: 3.21, changePercent: 2.30 },
      { symbol: "NVDA", name: "NVIDIA Corporation", price: 495.22, change: 12.45, changePercent: 2.58 },
    ];
    
    const query = request.nextUrl.searchParams.get("q")?.toLowerCase() || "";
    const results = mockStocks
      .filter(stock => 
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
      )
      .slice(0, 5);
    
    return NextResponse.json({ results });
  }
}