import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/middleware/rate-limit", () => ({ checkRateLimit: vi.fn(() => null) }));
vi.mock("@/lib/services/intrinsic-value.service", () => ({
  IntrinsicValueService: { calculateIntrinsicValue: vi.fn() },
}));

import { getServerSession } from "next-auth";
import { IntrinsicValueService } from "@/lib/services/intrinsic-value.service";
import { GET } from "./route";

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedCalculate = vi.mocked(IntrinsicValueService.calculateIntrinsicValue);

describe("GET /api/research/[symbol]/intrinsic-value (ADR-12)", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
    mockedGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCalculate.mockReset();
  });

  it("returns 200 with a well-formed unavailable payload when the service reports no fundamental data (data-absence, not an error)", async () => {
    mockedCalculate.mockRejectedValue(new Error("No fundamental data available"));

    const res = await GET(
      new NextRequest("http://localhost/api/research/ENGI.PA/intrinsic-value?price=42.5"),
      { params: Promise.resolve({ symbol: "ENGI.PA" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      currentPrice: 42.5,
      intrinsicValue: null,
      upside: null,
      upsidePercent: null,
      methods: [],
      confidence: "low",
    });
    expect(typeof body.lastUpdated).toBe("string");
  });

  it("still returns 500 for a genuine, unrelated error", async () => {
    mockedCalculate.mockRejectedValue(new Error("Yahoo Finance is down"));

    const res = await GET(
      new NextRequest("http://localhost/api/research/AAPL/intrinsic-value?price=200"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );

    expect(res.status).toBe(500);
  });

  it("returns 200 with the real calculated result on the happy path", async () => {
    mockedCalculate.mockResolvedValue({
      currentPrice: 200,
      intrinsicValue: 220,
      upside: 20,
      upsidePercent: 10,
      methods: [
        { name: "DCF Lite", value: 220, formula: "…", inputs: {}, confidence: "medium" },
      ],
      confidence: "medium",
      lastUpdated: new Date("2026-07-18T00:00:00.000Z"),
      scenarioLow: null,
      scenarioHigh: null,
      validMethodCount: 1,
    });

    const res = await GET(
      new NextRequest("http://localhost/api/research/AAPL/intrinsic-value?price=200"),
      { params: Promise.resolve({ symbol: "AAPL" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intrinsicValue).toBe(220);
    expect(body.methods).toHaveLength(1);
  });
});
