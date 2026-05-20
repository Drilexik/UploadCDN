import { NextResponse } from "next/server";
import { detectAttackPattern, handleSuspiciousRequest } from "@/lib/requestSecurity";
import { sanitizeInput, isPathTraversalAttempt } from "@/lib/inputValidation";
import { logSecurityEvent } from "@/lib/security";

/**
 * Advanced security middleware for all requests
 * Detects and prevents various attack patterns
 */

export async function middleware(request) {
  const response = NextResponse.next();

  // Extract request info
  const url = request.nextUrl.pathname;
  const method = request.method;
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // 1. Check for path traversal attempts
  if (isPathTraversalAttempt(url)) {
    logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
      url,
      ip,
      method,
    });

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  // 2. Check request body for suspicious patterns (for POST/PUT)
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      const bodyText = await request.text();

      // Detect attack patterns in body
      const attackPatterns = detectAttackPattern(request, bodyText);

      if (attackPatterns.length > 0) {
        const blockResult = handleSuspiciousRequest(request, attackPatterns);

        if (blockResult.block) {
          logSecurityEvent("ATTACK_PATTERN_DETECTED", {
            patterns: attackPatterns,
            url,
            ip,
          });

          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }
      }

      // Re-create request with body for downstream handlers
      request = new Request(request, { body: bodyText });
    } catch (error) {
      logSecurityEvent("MIDDLEWARE_ERROR", {
        error: error.message,
        url,
      });
    }
  }

  // 3. Add security headers to all responses
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:"
  );
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  // 4. Remove sensitive headers that reveal server info
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");
  response.headers.delete("X-AspNet-Version");
  response.headers.delete("X-Runtime-Version");

  // 5. Enforce cache control for API endpoints
  if (url.startsWith("/api/")) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
