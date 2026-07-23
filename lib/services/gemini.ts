// lib/services/gemini.ts
// Single source of truth for the Gemini model name used by both AI call
// sites (sentiment.service.ts, app/api/insights/portfolio/route.ts). Change
// the model in exactly one place — see plans/2026-07-20-gemini-model-update.md.
//
// The previous model (Gemini 1.5 Flash) was retired by Google in 2026 and
// started returning 404 on generateContent. Replaced 2026-07-20 with
// gemini-2.5-flash, live-verified against the installed
// @google/generative-ai@0.24.1 SDK and the production API key.
import { GoogleGenerativeAI } from '@google/generative-ai';

export const GEMINI_MODEL = 'gemini-2.5-flash';

// TD-12 (plans/2026-07-23-lib-cleanup-batch.md): the single sanctioned place
// `new GoogleGenerativeAI(...)` is constructed. Both call sites previously
// instantiated their own client identically but differed in missing-key
// behavior — sentiment.service.ts throws at construction (module-scope
// singleton, so it throws at import time); app/api/insights/portfolio/route.ts
// returns a graceful 200 placeholder and never constructs a client at all when
// the key is absent. This factory does not impose one policy on both — it
// only centralizes the client construction itself. See AGENT.md fragile
// surfaces and DECISIONS.md ADR-27.

/** A single read of `process.env.GEMINI_API_KEY`. */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/**
 * Constructs the shared Gemini client. Takes an explicit key (defaulting to
 * `getGeminiApiKey()`), throwing the same message call sites already threw
 * before consolidation when no key is available.
 */
export function createGeminiClient(apiKey: string | undefined = getGeminiApiKey()): GoogleGenerativeAI {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}
