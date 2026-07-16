import { NextRequest, NextResponse } from "next/server";

const attempts = new Map<string, { count: number; resetTime: number }>();

/**
 * Route-handler-friendly rate limiter: returns a 429 NextResponse when the
 * caller's IP has exceeded maxAttempts within windowMs, or null to proceed.
 * `scope` namespaces the counter per-route so limits don't bleed across routes.
 *
 * Usage:
 *   const limited = checkRateLimit(request, "register", 5, 60_000);
 *   if (limited) return limited;
 */
export function checkRateLimit(
  request: NextRequest,
  scope: string,
  maxAttempts: number,
  windowMs: number
): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();

  const record = attempts.get(key);

  if (!record || record.resetTime < now) {
    attempts.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  if (record.count >= maxAttempts) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  record.count++;
  return null;
}
