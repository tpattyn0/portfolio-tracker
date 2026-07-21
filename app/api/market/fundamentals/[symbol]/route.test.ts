import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_SCORING_WEIGHTS, type FundamentalWeights } from "@/lib/utils/scoring-weights";

let authResult: { error?: NextResponse; userId?: string };
let weightsResult: { composite: unknown; fundamental: FundamentalWeights };

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => authResult),
}));

vi.mock("@/lib/services/scoring-preferences.service", () => ({
  getWeights: vi.fn(async () => weightsResult),
}));

const fetchFundamentalsMock = vi.fn();
vi.mock("@/lib/services/fundamental-analysis.service", () => ({
  fundamentalAnalysisService: {
    fetchFundamentals: (...args: unknown[]) => fetchFundamentalsMock(...args),
  },
}));

import { GET } from "./route";

function makeRequest(symbol: string) {
  return new NextRequest(`http://localhost/api/market/fundamentals/${symbol}`);
}

describe("GET /api/market/fundamentals/[symbol]", () => {
  beforeEach(() => {
    fetchFundamentalsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const res = await GET(makeRequest("AAPL"), { params: Promise.resolve({ symbol: "AAPL" }) });
    expect(res.status).toBe(401);
    expect(fetchFundamentalsMock).not.toHaveBeenCalled();
  });

  it("loads the user's fundamental weights and passes them to fetchFundamentals", async () => {
    authResult = { userId: "user-1" };
    weightsResult = { composite: DEFAULT_SCORING_WEIGHTS.composite, fundamental: { valuation: 1, profitability: 0, growth: 0, financial: 0, dividend: 0 } };
    fetchFundamentalsMock.mockResolvedValueOnce({ score: { total: 8, breakdown: {} } });

    const res = await GET(makeRequest("AAPL"), { params: Promise.resolve({ symbol: "AAPL" }) });
    expect(res.status).toBe(200);
    expect(fetchFundamentalsMock).toHaveBeenCalledWith("AAPL", weightsResult.fundamental);
  });

  it("a custom-weight user's response total differs from a default user's, breakdown identical", async () => {
    authResult = { userId: "user-1" };
    const breakdown = { valuation: 8, profitability: 2, growth: 5, financial: 5, dividend: 0 };

    weightsResult = { composite: DEFAULT_SCORING_WEIGHTS.composite, fundamental: DEFAULT_SCORING_WEIGHTS.fundamental };
    fetchFundamentalsMock.mockResolvedValueOnce({ score: { total: 5.15, breakdown } });
    const defaultRes = await GET(makeRequest("AAPL"), { params: Promise.resolve({ symbol: "AAPL" }) });
    const defaultBody = await defaultRes.json();

    weightsResult = { composite: DEFAULT_SCORING_WEIGHTS.composite, fundamental: { valuation: 1, profitability: 0, growth: 0, financial: 0, dividend: 0 } };
    fetchFundamentalsMock.mockResolvedValueOnce({ score: { total: 8, breakdown } });
    const customRes = await GET(makeRequest("AAPL"), { params: Promise.resolve({ symbol: "AAPL" }) });
    const customBody = await customRes.json();

    expect(customBody.score.total).not.toBe(defaultBody.score.total);
    expect(customBody.score.breakdown).toEqual(defaultBody.score.breakdown);
  });

  it("returns 500 on a service error", async () => {
    authResult = { userId: "user-1" };
    weightsResult = { composite: DEFAULT_SCORING_WEIGHTS.composite, fundamental: DEFAULT_SCORING_WEIGHTS.fundamental };
    fetchFundamentalsMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET(makeRequest("AAPL"), { params: Promise.resolve({ symbol: "AAPL" }) });
    expect(res.status).toBe(500);
  });
});
