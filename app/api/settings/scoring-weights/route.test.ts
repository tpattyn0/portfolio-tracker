import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/utils/scoring-weights";

let authResult: { error?: NextResponse; userId?: string };

vi.mock("@/lib/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => authResult),
}));

const getWeightsMock = vi.fn();
const saveWeightsMock = vi.fn();

vi.mock("@/lib/services/scoring-preferences.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/scoring-preferences.service")>(
    "@/lib/services/scoring-preferences.service"
  );
  return {
    ...actual,
    getWeights: (...args: unknown[]) => getWeightsMock(...args),
    saveWeights: (...args: unknown[]) => saveWeightsMock(...args),
  };
});

import { GET, PUT } from "./route";
import { InvalidScoringWeightsError } from "@/lib/services/scoring-preferences.service";

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings/scoring-weights", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("GET /api/settings/scoring-weights", () => {
  beforeEach(() => {
    getWeightsMock.mockReset();
    saveWeightsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getWeightsMock).not.toHaveBeenCalled();
  });

  it("returns defaults for a user with no row", async () => {
    authResult = { userId: "user-1" };
    getWeightsMock.mockResolvedValueOnce(DEFAULT_SCORING_WEIGHTS);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(DEFAULT_SCORING_WEIGHTS);
    expect(getWeightsMock).toHaveBeenCalledWith("user-1");
  });
});

describe("PUT /api/settings/scoring-weights", () => {
  beforeEach(() => {
    getWeightsMock.mockReset();
    saveWeightsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const res = await PUT(putRequest({ composite: { technical: 1 } }));
    expect(res.status).toBe(401);
    expect(saveWeightsMock).not.toHaveBeenCalled();
  });

  it("persists and returns the saved+defaulted set", async () => {
    authResult = { userId: "user-1" };
    const saved = { ...DEFAULT_SCORING_WEIGHTS, composite: { ...DEFAULT_SCORING_WEIGHTS.composite, technical: 1 } };
    saveWeightsMock.mockResolvedValueOnce(saved);

    const res = await PUT(putRequest({ composite: { technical: 1 } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(saved);
    expect(saveWeightsMock).toHaveBeenCalledWith("user-1", {
      composite: { technical: 1 },
      fundamental: undefined,
    });
  });

  it("returns 400 for a negative weight", async () => {
    authResult = { userId: "user-1" };
    saveWeightsMock.mockRejectedValueOnce(new InvalidScoringWeightsError('Invalid composite weight "technical"'));

    const res = await PUT(putRequest({ composite: { technical: -1 } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/technical/);
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
