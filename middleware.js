import { NextResponse } from "next/server";

/**
 * Edge middleware: applies to every request before it reaches a route.
 *
 * NOTE: this runs in the Edge runtime, so it must NOT import anything that
 * pulls in Node built-ins (fs/path) and must NOT read the request body
 * (consuming it here would break multipart uploads downstream). Body-level
 * validation lives in the route handlers; here we only inspect the URL and
 * headers, then attach security headers.
 */

// Lightweight, edge-safe security logger.
function logSecurity(eventType, details) {
  console.error(`[SECURITY] ${JSON.stringify({ timestamp: new Date().toISOString(), eventType, ...details })}`);
}

// Path-traversal signatures (raw and percent-encoded).
const TRAVERSAL = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c|%2e%2e\/|\.\.%2f|\.\.%5c|\.\.;|\.\.%00)/i;

// Known offensive security scanners — block outright.
const SCANNER_UA = /sqlmap|nikto|nmap|masscan|metasploit|burpsuite|zaproxy|acunetix|nessus|wpscan/i;

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  // 1. Block path traversal in the URL (decoded once; ignore malformed input).
  let decodedUrl = pathname + search;
  try {
    decodedUrl = decodeURIComponent(decodedUrl);
  } catch {
    logSecurity("MALFORMED_URL", { url: pathname, ip });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (TRAVERSAL.test(decodedUrl)) {
    logSecurity("PATH_TRAVERSAL_ATTEMPT", { url: pathname, ip });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // 2. Block known vulnerability scanners by User-Agent.
  if (SCANNER_UA.test(userAgent)) {
    logSecurity("SCANNER_BLOCKED", { url: pathname, ip, userAgent });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // 3. Attach security headers to the response.
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://matomo.drilex.cz https://owa.drilex.cz https://www.clarity.ms https://*.clarity.ms; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://matomo.drilex.cz https://owa.drilex.cz https://www.clarity.ms https://*.clarity.ms"
  );
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");

  // Strip headers that leak server internals.
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");

  // No caching for API endpoints.
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  // Match everything except Next internals and the public favicon, so static
  // chunks and image optimisation aren't needlessly processed.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png).*)"],
};
