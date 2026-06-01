import { NextResponse } from "next/server";
import { listFiles } from "@/lib/storage";
import { enforceAuth } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security";
import { createRateLimiter } from "@/lib/rateLimiter";
import { getClientIp } from "@/lib/clientIp";

// 10 requests per minute for listing files. This is also the endpoint the UI
// probes to verify the password, so it is the primary brute-force surface —
// enforceAuth() adds an escalating per-IP lockout on top of this volume cap.
const listLimiter = createRateLimiter(10, 60000);

export async function GET(request) {
  // Rate limiting
  const rateLimitResult = listLimiter(request);
  if (rateLimitResult.limited) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { endpoint: "/api/files", ip: getClientIp(request) });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
    );
  }

  // Authentication + brute-force lockout
  const auth = enforceAuth(request, "/api/files");
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(listFiles());
  } catch (e) {
    logSecurityEvent("LIST_FILES_ERROR", { error: e.message });
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
