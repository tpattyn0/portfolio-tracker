import { NextRequest } from "next/server";

export async function validateCSRF(request: NextRequest) {
  if (request.method === "GET") return true;
  
  const token = request.headers.get("x-csrf-token");
  const sessionToken = request.cookies.get("csrf-token");
  
  if (!token || !sessionToken || token !== sessionToken.value) {
    throw new Error("Invalid CSRF token");
  }
  
  return true;
}