import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Portfolio } from "@prisma/client";

/**
 * Result type for getAuthenticatedUser.
 *
 * Uses a "discriminated union" — TypeScript can narrow the type based on
 * the `error` field. If `error` is present, you should return it as a
 * response. If not, `userId` is guaranteed to be a string.
 *
 * Usage:
 *   const auth = await getAuthenticatedUser();
 *   if (auth.error) return auth.error;
 *   // TypeScript now knows auth.userId is a string
 */
type AuthResult =
  | { error: NextResponse; userId?: never }
  | { error?: never; userId: string };

type AuthWithPortfolioResult =
  | { error: NextResponse; userId?: never; portfolio?: never }
  | { error?: never; userId: string; portfolio: Portfolio };

/**
 * Verifies the user is authenticated and returns their user ID.
 * Returns a 401 JSON response if not authenticated.
 *
 * Example:
 *   const auth = await getAuthenticatedUser();
 *   if (auth.error) return auth.error;
 *   console.log(auth.userId); // guaranteed to be a string
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { userId: session.user.id };
}

/**
 * Verifies the user is authenticated AND has a portfolio.
 * Returns a 401 or 404 JSON response on failure.
 *
 * This is the most common pattern — almost every portfolio route needs both
 * the authenticated user and their portfolio record.
 *
 * Example:
 *   const auth = await getAuthenticatedUserWithPortfolio();
 *   if (auth.error) return auth.error;
 *   console.log(auth.userId, auth.portfolio.id);
 */
export async function getAuthenticatedUserWithPortfolio(): Promise<AuthWithPortfolioResult> {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth;

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: auth.userId },
  });

  if (!portfolio) {
    return {
      error: NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      ),
    };
  }

  return { userId: auth.userId, portfolio };
}
