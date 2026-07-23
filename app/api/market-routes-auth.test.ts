// New file (Task 3 + Task 6) — covers the 2 auth-guard routes not exercised
// by app/api/auth-guard.test.ts (market/quote, market/chart), which must stay
// a byte-identical zero-diff behavior-preservation gate for TD-08. Also
// covers TD-15's route-level assertion that a failing getQuote produces a
// genuine non-ok response (Task 6) — see plans/2026-07-23-td08-td15-cleanup.md.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/services/market-data.service", () => ({
  marketDataService: { getQuote: vi.fn(), getHistoricalData: vi.fn() },
}));
vi.mock("@/lib/services/technical-analysis.service", () => ({
  technicalAnalysisService: { getCachedIndicators: vi.fn() },
}));

import { getServerSession } from "next-auth";
import { marketDataService } from "@/lib/services/market-data.service";
import { technicalAnalysisService } from "@/lib/services/technical-analysis.service";
import { GET as quoteGet } from "./market/quote/[symbol]/route";
import { GET as chartGet } from "./market/chart/[symbol]/route";

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedGetQuote = vi.mocked(marketDataService.getQuote);
const mockedGetHistoricalData = vi.mocked(marketDataService.getHistoricalData);
const mockedGetCachedIndicators = vi.mocked(technicalAnalysisService.getCachedIndicators);

describe("market/quote/[symbol] and market/chart/[symbol] auth guard (TD-08)", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
    mockedGetQuote.mockReset();
    mockedGetHistoricalData.mockReset();
    mockedGetCachedIndicators.mockReset();
  });

  it("market/quote/[symbol] returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await quoteGet(
      new NextRequest("http://localhost/api/market/quote/AAPL"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(401);
    expect(mockedGetQuote).not.toHaveBeenCalled();
  });

  it("market/quote/[symbol] passes through with a valid session", async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetQuote.mockResolvedValueOnce({ symbol: "AAPL", price: 100 } as never);
    const res = await quoteGet(
      new NextRequest("http://localhost/api/market/quote/AAPL"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(200);
  });

  it("market/chart/[symbol] returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chartGet(
      new NextRequest("http://localhost/api/market/chart/AAPL?period=1M"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(401);
    expect(mockedGetHistoricalData).not.toHaveBeenCalled();
  });

  it("market/chart/[symbol] passes through with a valid session", async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetHistoricalData.mockResolvedValue([{ date: "2026-01-01", value: 100, volume: 1000 }] as never);
    mockedGetCachedIndicators.mockReturnValue({ signal: "NEUTRAL", score: 5 } as never);
    const res = await chartGet(
      new NextRequest("http://localhost/api/market/chart/AAPL?period=1M"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/market/quote/[symbol] — non-ok response on service failure (TD-15 Task 6)", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
    mockedGetQuote.mockReset();
  });

  it("returns a non-ok (500) status when getQuote rejects", async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetQuote.mockRejectedValueOnce(new Error("Failed to fetch market data for AAPL"));
    const res = await quoteGet(
      new NextRequest("http://localhost/api/market/quote/AAPL"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(500);
  });

  it("returns 200 when getQuote resolves", async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetQuote.mockResolvedValueOnce({ symbol: "AAPL", price: 100 } as never);
    const res = await quoteGet(
      new NextRequest("http://localhost/api/market/quote/AAPL"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(200);
  });
});
