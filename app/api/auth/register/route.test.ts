import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "new@example.com",
        name: "New User",
      }),
    },
  },
}));

import { POST } from "./route";

function registerRequest(ip: string, body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register rate limiting (ONB-03/ONB-13)", () => {
  const validBody = { email: "new@example.com", password: "password123" };

  it("allows registration under the limit", async () => {
    const ip = `10.0.0.${Math.random()}`;
    const res = await POST(registerRequest(ip, validBody));
    expect(res.status).toBe(200);
  });

  it("returns 429 after exceeding the per-IP attempt limit", async () => {
    const ip = `10.0.1.${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      await POST(registerRequest(ip, validBody));
    }
    const res = await POST(registerRequest(ip, validBody));
    expect(res.status).toBe(429);
  });
});
