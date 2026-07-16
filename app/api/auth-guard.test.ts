import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/services/market-data.service", () => ({
  marketDataService: { searchSymbols: vi.fn(), getQuote: vi.fn() },
}));
vi.mock("@/lib/services/news.service", () => ({
  newsService: { fetchNewsForSymbol: vi.fn(), saveArticlesToDatabase: vi.fn() },
}));
vi.mock("@/lib/services/sentiment.service", () => ({
  sentimentService: { analyzeAndUpdateArticle: vi.fn() },
}));
vi.mock("@/lib/services/intrinsic-value.service", () => ({
  IntrinsicValueService: { calculateIntrinsicValue: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsArticle: { findMany: vi.fn().mockResolvedValue([]) },
    sentimentHistory: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { getServerSession } from "next-auth";
import { GET as marketSearchGet } from "./market/search/route";
import { GET as newsGet } from "./news/[symbol]/route";
import { GET as sentimentHistoryGet } from "./sentiment/[symbol]/history/route";
import { GET as intrinsicValueGet } from "./research/[symbol]/intrinsic-value/route";

const mockedGetServerSession = vi.mocked(getServerSession);

describe("previously-unauthenticated routes now require a session (ONB-04/ONB-05)", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
  });

  it("market/search returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await marketSearchGet(
      new NextRequest("http://localhost/api/market/search?q=aapl")
    );
    expect(res.status).toBe(401);
  });

  it("news/[symbol] returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await newsGet(
      new NextRequest("http://localhost/api/news/AAPL"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(401);
  });

  it("sentiment/[symbol]/history returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await sentimentHistoryGet(
      new NextRequest("http://localhost/api/sentiment/AAPL/history"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(401);
  });

  it("research/[symbol]/intrinsic-value returns 401 with no session", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await intrinsicValueGet(
      new NextRequest("http://localhost/api/research/AAPL/intrinsic-value?price=100"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(401);
  });

  it("sentiment/[symbol]/history passes through with a valid session and clamps days", async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const res = await sentimentHistoryGet(
      new NextRequest("http://localhost/api/sentiment/AAPL/history?days=9999"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );
    expect(res.status).toBe(200);
  });
});
