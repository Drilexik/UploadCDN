import { NextResponse } from "next/server";
import { listFiles, checkAuth } from "@/lib/storage";
import { logSecurityEvent } from "@/lib/security";
import { createRateLimiter } from "@/lib/rateLimiter";

// 10 requests per minute for listing files
const listLimiter = createRateLimiter(10, 60000);

export async function GET(request) {
  // Rate limiting
  const rateLimitResult = listLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", {
      endpoint: "/api/files",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": rateLimitResult.retryAfter },
      }
    );
  }

  // Authentication
  if (!checkAuth(request)) {
    logSecurityEvent("UNAUTHORIZED_LIST_ATTEMPT", {
      endpoint: "/api/files",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(listFiles());
  } catch (e) {
    logSecurityEvent("LIST_FILES_ERROR", {
      error: e.message,
    });
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
