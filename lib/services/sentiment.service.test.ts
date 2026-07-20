// lib/services/sentiment.service.test.ts
//
// plans/2026-07-20-gemini-model-update.md Task 4: guards against a regression
// to the retired `gemini-1.5-flash` model (404 on generateContent) or an
// unnoticed change to the shared GEMINI_MODEL constant. No live Gemini
// network calls — @google/generative-ai is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getGenerativeModelMock, generateContentMock } = vi.hoisted(() => {
  // sentiment.service.ts constructs a module-scope singleton
  // (`export const sentimentService = ...`) that throws at import time if
  // GEMINI_API_KEY is unset (see AGENT.md fragile surfaces) — set it inside
  // vi.hoisted so it runs before the static import below is evaluated.
  process.env.GEMINI_API_KEY = "test-key";
  return {
    getGenerativeModelMock: vi.fn(),
    generateContentMock: vi.fn(),
  };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: unknown) {
    return { getGenerativeModel: getGenerativeModelMock };
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { GEMINI_MODEL } from "@/lib/services/gemini";
import { SentimentAnalysisService } from "./sentiment.service";

describe("GEMINI_MODEL constant", () => {
  it("is the live-verified replacement model, not the retired gemini-1.5-flash", () => {
    expect(GEMINI_MODEL).toBe("gemini-2.5-flash");
  });
});

describe("SentimentAnalysisService.analyzeSentiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            sentiment: 0.5,
            sentimentLabel: "positive",
            confidence: 0.8,
            keyFactors: ["strong earnings"],
            impact: "medium",
            aiSummary: "Positive earnings beat.",
          }),
      },
    });
    getGenerativeModelMock.mockReturnValue({
      generateContent: generateContentMock,
    });
  });

  it("requests the shared GEMINI_MODEL constant, not a hardcoded model string", async () => {
    const service = new SentimentAnalysisService();

    await service.analyzeSentiment("Some headline", "Some content", "AAPL");

    expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: GEMINI_MODEL });
    expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: "gemini-2.5-flash" });
    expect(getGenerativeModelMock).not.toHaveBeenCalledWith({ model: "gemini-1.5-flash" });
  });

  it("returns neutral sentiment (graceful degradation) if generateContent fails, e.g. a 404 from a retired model", async () => {
    generateContentMock.mockRejectedValueOnce(
      new Error("[404 Not Found] models/gemini-1.5-flash is not found for API version v1beta")
    );
    const service = new SentimentAnalysisService();

    const result = await service.analyzeSentiment("Some headline", "Some content", "AAPL");

    expect(result).toEqual({
      sentiment: 0,
      sentimentLabel: "neutral",
      confidence: 0.5,
      keyFactors: [],
      impact: "low",
    });
  });
});
