import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit } from "./rate-limit";

function requestFromIp(ip: string) {
  return new NextRequest("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const ip = `1.1.1.${Math.random()}`;
    const req = requestFromIp(ip);
    expect(checkRateLimit(req, "test-under", 3, 60_000)).toBeNull();
    expect(checkRateLimit(req, "test-under", 3, 60_000)).toBeNull();
  });

  it("returns 429 once maxAttempts is exceeded", async () => {
    const ip = `2.2.2.${Math.random()}`;
    const scope = "test-over";
    const req = requestFromIp(ip);

    checkRateLimit(req, scope, 2, 60_000);
    checkRateLimit(req, scope, 2, 60_000);
    const result = checkRateLimit(req, scope, 2, 60_000);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    const body = await result?.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  it("namespaces counters by scope so one route's limit doesn't affect another", () => {
    const ip = `3.3.3.${Math.random()}`;
    const req = requestFromIp(ip);

    checkRateLimit(req, "scope-a", 1, 60_000);
    const blockedInA = checkRateLimit(req, "scope-a", 1, 60_000);
    const allowedInB = checkRateLimit(req, "scope-b", 1, 60_000);

    expect(blockedInA?.status).toBe(429);
    expect(allowedInB).toBeNull();
  });
});
