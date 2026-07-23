import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Regression test for the morning-note fix (plans/2026-07-22-morning-note-active-positions-only.md):
 * the insights route previously loaded ALL positions with no filter, so a
 * fully-sold-but-not-deleted position (quantity: 0, retained by design —
 * see ADR-18) leaked into the Gemini prompt as if still held. The route
 * now mirrors the existing `quantity: { gt: 0 }` convention already used by
 * `app/api/portfolio/route.ts`.
 */

const PORTFOLIO_ID = "portfolio-1";

function makePosition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "position-1",
    portfolioId: PORTFOLIO_ID,
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: new Decimal(10),
    avgCostBasis: new Decimal(150),
    currentPrice: new Decimal(250),
    marketValue: new Decimal(2500),
    unrealizedPL: new Decimal(1000),
    unrealizedPLPercent: new Decimal(66.67),
    firstBuyDate: new Date("2026-01-01"),
    lastActivity: new Date("2026-01-01"),
    ...overrides,
  };
}

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ userId: "user-1" })),
}));

// Mock prisma so that findUnique's `include.positions.where` is actually
// honoured — this is what makes the test fail if the route's filter is
// ever removed (a naive mock that always returns both rows regardless of
// the include's `where` clause would not).
const findUniqueMock = vi.fn(
  async ({ include }: { include?: { positions?: { where?: { quantity?: { gt?: number } } } } }) => {
    const allPositions = [
      makePosition({ ticker: "AAPL", quantity: new Decimal(10) }),
      makePosition({
        id: "position-2",
        ticker: "ARGX", // closed position — fully sold, row retained at quantity 0 (ADR-18)
        quantity: new Decimal(0),
      }),
    ];

    const minQty = include?.positions?.where?.quantity?.gt;
    const positions =
      minQty === undefined
        ? allPositions
        : allPositions.filter((p) => p.quantity.toNumber() > minQty);

    return { id: PORTFOLIO_ID, userId: "user-1", positions };
  }
);

const findUniqueInsightMock = vi.fn(async (..._args: unknown[]) => null);
const createInsightMock = vi.fn(async ({ data }: { data: Record<string, unknown> }) => data);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolio: {
      findUnique: (...args: unknown[]) => findUniqueMock(...(args as [never])),
    },
    portfolioInsight: {
      findUnique: (...args: unknown[]) => findUniqueInsightMock(...(args as [never])),
      create: (...args: unknown[]) => createInsightMock(...(args as [never])),
    },
  },
}));

// Capture the prompt text so we can assert directly on which tickers were
// handed to generation, without making a real network call.
let lastPrompt = "";
const generateContentMock = vi.fn(async (prompt: string) => {
  lastPrompt = prompt;
  return {
    response: {
      text: () =>
        JSON.stringify({
          marketSummary: "Stable session",
          marketSentiment: 0.1,
          portfolioImpact: "Minimal impact",
          topRisks: ["Volatility"],
          opportunities: ["Diversify"],
          recommendations: ["Hold"],
        }),
    },
  };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function GoogleGenerativeAIMock() {
    return {
      getGenerativeModel: () => ({
        generateContent: generateContentMock,
      }),
    };
  }),
}));

describe("GET /api/insights/portfolio — current holdings only", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    findUniqueMock.mockClear();
    findUniqueInsightMock.mockClear();
    createInsightMock.mockClear();
    generateContentMock.mockClear();
    lastPrompt = "";
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("filters the position include by quantity > 0, mirroring app/api/portfolio/route.ts", async () => {
    const { GET } = await import("./route");
    await GET();

    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    const callArgs = findUniqueMock.mock.calls[0][0] as {
      include: { positions: { where: { quantity: { gt: number } } } };
    };
    expect(callArgs.include.positions.where.quantity.gt).toBe(0);
  });

  it("passes only the held ticker (AAPL) to generation, excluding the closed ARGX position", async () => {
    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(lastPrompt).toContain("AAPL");
    expect(lastPrompt).not.toContain("ARGX");
    expect(lastPrompt).toContain("1 positions");
  });

  it("returns the empty-portfolio response and never calls Gemini when only closed positions remain", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: PORTFOLIO_ID,
      userId: "user-1",
      positions: [], // simulates the DB-level filter having excluded every quantity:0 row
    }));

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.marketSummary).toBe("No positions in portfolio to analyze");
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(createInsightMock).not.toHaveBeenCalled();
  });
});
