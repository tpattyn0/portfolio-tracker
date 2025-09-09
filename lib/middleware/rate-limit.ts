import { NextRequest } from "next/server";

const attempts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxAttempts: number, windowMs: number) {
  return async function(request: NextRequest) {
    const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    
    const userAttempts = attempts.get(ip);
    
    if (!userAttempts || userAttempts.resetTime < now) {
      attempts.set(ip, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (userAttempts.count >= maxAttempts) {
      throw new Error("Too many requests");
    }
    
    userAttempts.count++;
    return true;
  };
}