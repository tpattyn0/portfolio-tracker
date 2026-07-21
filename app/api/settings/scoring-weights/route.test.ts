import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_SCORING_WEIGHTS, fractionsToPercents } from "@/lib/utils/scoring-weights";

let authResult: { error?: NextResponse; userId?: string };

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => authResult),
}));

const getWeightsForSettingsMock = vi.fn();
const saveWeightsMock = vi.fn();

vi.mock("@/lib/services/scoring-preferences.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/scoring-preferences.service")>(
    "@/lib/services/scoring-preferences.service"
  );
  return {
    ...actual,
    getWeightsForSettings: (...args: unknown[]) => getWeightsForSettingsMock(...args),
    saveWeights: (...args: unknown[]) => saveWeightsMock(...args),
  };
});

import { GET, PUT } from "./route";
import { InvalidScoringWeightsError } from "@/lib/services/scoring-preferences.service";

const DEFAULT_PERCENTS = {
  composite: fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite),
  fundamental: fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental),
};
const COMPLETE_COMPOSITE_PERCENT = { intrinsicValue: 25, fundamental: 25, technical: 20, sentiment: 15, analyst: 15 };

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings/scoring-weights", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("GET /api/settings/scoring-weights", () => {
  beforeEach(() => {
    getWeightsForSettingsMock.mockReset();
    saveWeightsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getWeightsForSettingsMock).not.toHaveBeenCalled();
  });

  it("returns percents summing to 100 for a user with no row", async () => {
    authResult = { userId: "user-1" };
    getWeightsForSettingsMock.mockResolvedValueOnce(DEFAULT_PERCENTS);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(DEFAULT_PERCENTS);
    expect(Object.values(body.composite).reduce((a: number, b: unknown) => a + (b as number), 0)).toBe(100);
    expect(Object.values(body.fundamental).reduce((a: number, b: unknown) => a + (b as number), 0)).toBe(100);
    expect(getWeightsForSettingsMock).toHaveBeenCalledWith("user-1");
  });
});

describe("PUT /api/settings/scoring-weights", () => {
  beforeEach(() => {
    getWeightsForSettingsMock.mockReset();
    saveWeightsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const res = await PUT(putRequest({ composite: COMPLETE_COMPOSITE_PERCENT }));
    expect(res.status).toBe(401);
    expect(saveWeightsMock).not.toHaveBeenCalled();
  });

  it("persists and returns the saved percent set for a valid 100-sum group", async () => {
    authResult = { userId: "user-1" };
    const saved = { ...DEFAULT_SCORING_WEIGHTS, composite: COMPLETE_COMPOSITE_PERCENT };
    saveWeightsMock.mockResolvedValueOnce(saved);

    const res = await PUT(putRequest({ composite: COMPLETE_COMPOSITE_PERCENT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(saved);
    expect(saveWeightsMock).toHaveBeenCalledWith("user-1", {
      composite: COMPLETE_COMPOSITE_PERCENT,
      fundamental: undefined,
    });
  });

  it("returns 400 when a group sums to 94 (not 100)", async () => {
    authResult = { userId: "user-1" };
    saveWeightsMock.mockRejectedValueOnce(
      new InvalidScoringWeightsError("Invalid composite weights: must sum to 100 (got 94)")
    );

    const short = { ...COMPLETE_COMPOSITE_PERCENT, analyst: 9 }; // sums to 94
    const res = await PUT(putRequest({ composite: short }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sum to 100/);
  });

  it("returns 200 for a valid 100-sum group", async () => {
    authResult = { userId: "user-1" };
    const saved = { ...DEFAULT_SCORING_WEIGHTS, composite: COMPLETE_COMPOSITE_PERCENT };
    saveWeightsMock.mockResolvedValueOnce(saved);

    const res = await PUT(putRequest({ composite: COMPLETE_COMPOSITE_PERCENT }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for an invalid JSON body", async () => {
    authResult = { userId: "user-1" };
    const badRequest = new NextRequest("http://localhost/api/settings/scoring-weights", {
      method: "PUT",
      body: "{not json",
    });
    const res = await PUT(badRequest);
    expect(res.status).toBe(400);
    expect(saveWeightsMock).not.toHaveBeenCalled();
  });
});
