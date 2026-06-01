import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/storage";
import { checkLockout, recordFailure, recordSuccess } from "@/lib/bruteforce";
import { logSecurityEvent } from "@/lib/security";
import { getClientIp } from "@/lib/clientIp";

/**
 * Single entry point for protecting an authenticated endpoint.
 *
 * Combines, in order:
 *   1. Brute-force lockout check (per client IP, escalating).
 *   2. Password verification (scrypt hash or legacy plaintext).
 *   3. Recording the result so repeated failures eventually lock the IP out.
 *
 * Returns { ok: true } when the caller may proceed, or
 * { ok: false, response } with a ready-to-return NextResponse otherwise.
 *
 * Usage:
 *   const auth = enforceAuth(request, "/api/upload");
 *   if (!auth.ok) return auth.response;
 */
export function enforceAuth(request, endpoint) {
  const ip = getClientIp(request);

  const lockout = checkLockout(request);
  if (lockout.locked) {
    logSecurityEvent("AUTH_BLOCKED_LOCKOUT", { ip, endpoint, retryAfter: lockout.retryAfter });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(lockout.retryAfter) } }
      ),
    };
  }

  if (!checkAuth(request)) {
    recordFailure(request, endpoint);
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  recordSuccess(request);
  return { ok: true };
}
