import { NextResponse } from "next/server";
import yahooFinance from 'yahoo-finance2';

export async function GET() {
  try {
    // Test Yahoo Finance connection
    const quote = await yahooFinance.quoteSummary('AAPL', {
      modules: ['price']
    });
    
    return NextResponse.json({
      success: true,
      data: {
        symbol: quote.price?.symbol,
        price: quote.price?.regularMarketPrice,
        currency: quote.price?.currency,
        exchange: quote.price?.exchange
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}