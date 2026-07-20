// lib/services/gemini.ts
// Single source of truth for the Gemini model name used by both AI call
// sites (sentiment.service.ts, app/api/insights/portfolio/route.ts). Change
// the model in exactly one place — see plans/2026-07-20-gemini-model-update.md.
//
// The previous model (Gemini 1.5 Flash) was retired by Google in 2026 and
// started returning 404 on generateContent. Replaced 2026-07-20 with
// gemini-2.5-flash, live-verified against the installed
// @google/generative-ai@0.24.1 SDK and the production API key.
export const GEMINI_MODEL = 'gemini-2.5-flash';
