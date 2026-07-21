import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/auth";
import {
  getWeightsForSettings,
  saveWeights,
  InvalidScoringWeightsError,
} from "@/lib/services/scoring-preferences.service";

/**
 * GET/PUT the authenticated user's scoring weights
 * (plans/2026-07-20-configurable-scoring-weights.md, ADR-20/ADR-21; direct-percent
 * revision ADR-22, plans/2026-07-21-scoring-weights-direct-percent.md). Thin —
 * delegates to lib/services/scoring-preferences.service.ts (ADR-3): the
 * route does auth + I/O, the service stays pure business logic.
 *
 * GET returns whole percentages summing to 100 per group (`getWeightsForSettings`)
 * — this is the settings-page-only percent form; scoring consumers (overview.tsx,
 * fundamental-analysis.service.ts, wishlist.service.ts) read `getWeights`
 * (raw/fraction form) directly and are unaffected by this route.
 */

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;

  const weights = await getWeightsForSettings(auth.userId);
  return NextResponse.json(weights);
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as { composite?: unknown; fundamental?: unknown };

  try {
    const saved = await saveWeights(auth.userId, {
      composite: input.composite as Record<string, number> | undefined,
      fundamental: input.fundamental as Record<string, number> | undefined,
    });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof InvalidScoringWeightsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to save scoring weights:", error);
    return NextResponse.json({ error: "Failed to save scoring weights" }, { status: 500 });
  }
}
