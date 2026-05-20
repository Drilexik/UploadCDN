import { NextResponse } from "next/server";

/**
 * Request/Response interceptor for security monitoring
 * Detects and blocks suspicious patterns
 */

const SUSPICIOUS_PATTERNS = new Map();
const PATTERN_WINDOW = 60000; // 1 minute
const THRESHOLD = 10; // requests per minute

/**
 * Track suspicious request patterns
 */
export function trackSuspiciousPattern(ip, pattern, details) {
  const key = `${ip}:${pattern}`;
  const now = Date.now();

  if (!SUSPICIOUS_PATTERNS.has(key)) {
    SUSPICIOUS_PATTERNS.set(key, []);
  }

  const timestamps = SUSPICIOUS_PATTERNS.get(key);

  // Remove old entries
  const validTimestamps = timestamps.filter((ts) => now - ts < PATTERN_WINDOW);

  // Check threshold
  if (validTimestamps.length >= THRESHOLD) {
    return {
      blocked: true,
      reason: `Suspicious pattern detected: ${pattern}`,
    };
  }

  validTimestamps.push(now);
  SUSPICIOUS_PATTERNS.set(key, validTimestamps);

  return { blocked: false };
}

/**
 * Detect common attack patterns in request
 */
export function detectAttackPattern(request, body = "") {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const url = request.url || "";

  const patterns = [];

  // SQL injection attempts
  if (/('|")\s*(OR|AND|UNION|SELECT)/i.test(body + url)) {
    patterns.push("SQL_INJECTION");
  }

  // Command injection attempts
  if (/[;&|`$()\[\]{}]*\s*(rm|cat|wget|curl|bash)/i.test(body + url)) {
    patterns.push("COMMAND_INJECTION");
  }

  // XSS attempts
  if (/<script|javascript:|onerror|onload|onclick/i.test(body)) {
    patterns.push("XSS");
  }

  // Path traversal attempts
  if (/\.\.\//g.test(url)) {
    patterns.push("PATH_TRAVERSAL");
  }

  // XXE attempts
  if (/<!ENTITY|SYSTEM|PUBLIC/i.test(body)) {
    patterns.push("XXE");
  }

  // LDAP injection
  if (/[*()&|]/i.test(body) && /ldap/i.test(url)) {
    patterns.push("LDAP_INJECTION");
  }

  // No user agent (suspicious bots)
  if (!userAgent || userAgent.length === 0) {
    patterns.push("NO_USER_AGENT");
  }

  // Suspicious user agents
  if (
    /sqlmap|nikto|nmap|masscan|metasploit|burp|zaproxy|acunetix/i.test(userAgent)
  ) {
    patterns.push("SCANNER");
  }

  return patterns;
}

/**
 * Validate HTTP method for endpoint
 */
export function validateHTTPMethod(method, allowed = ["GET", "POST"]) {
  const normalizedMethod = method.toUpperCase();

  if (!allowed.includes(normalizedMethod)) {
    return {
      valid: false,
      error: `Method ${normalizedMethod} not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Validate content type
 */
export function validateContentType(contentType, allowed = ["application/json"]) {
  if (!contentType) {
    return { valid: false, error: "Content-Type header missing" };
  }

  const type = contentType.split(";")[0].trim().toLowerCase();

  if (!allowed.map((t) => t.toLowerCase()).includes(type)) {
    return { valid: false, error: "Invalid Content-Type" };
  }

  return { valid: true };
}

/**
 * Validate authorization header format
 */
export function validateAuthHeader(authHeader) {
  if (!authHeader) {
    return { valid: false, error: "Authorization header missing" };
  }

  // Basic validation
  if (typeof authHeader !== "string" || authHeader.length > 1000) {
    return { valid: false, error: "Invalid authorization header" };
  }

  return { valid: true };
}

/**
 * Prevent HTTP response splitting
 */
export function preventHeaderInjection(headerValue) {
  // Check for CRLF characters
  if (/[\r\n]/.test(headerValue)) {
    return false;
  }

  // Check for null bytes
  if (/\0/.test(headerValue)) {
    return false;
  }

  return true;
}

/**
 * Create security response with proper headers
 */
export function createSecurityResponse(data, statusCode = 200) {
  const response = NextResponse.json(data, { status: statusCode });

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Content-Security-Policy", "default-src 'none'");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  // Remove server identification
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");

  return response;
}

/**
 * Block response based on suspicious patterns
 */
export function handleSuspiciousRequest(request, patterns) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Log suspicious activity
  console.error("[SECURITY] Suspicious patterns detected", {
    ip,
    patterns,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  // Track patterns
  for (const pattern of patterns) {
    const result = trackSuspiciousPattern(ip, pattern, {
      url: request.url,
      timestamp: new Date().toISOString(),
    });

    if (result.blocked) {
      return {
        block: true,
        status: 403,
        message: "Access denied",
      };
    }
  }

  return { block: false };
}

/**
 * Sanitize request data to prevent double encoding attacks
 */
export function normalizeRequestData(data) {
  if (typeof data === "string") {
    // Single decode, prevent double encoding bypass
    return decodeURIComponent(data);
  }

  if (typeof data === "object" && data !== null) {
    const normalized = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] =
        typeof value === "string" ? decodeURIComponent(value) : value;
    }
    return normalized;
  }

  return data;
}

/**
 * Verify request signature (optional additional layer)
 */
export function verifyRequestSignature(request, secret) {
  const signature = request.headers.get("x-signature");

  if (!signature) {
    return { valid: false, error: "Missing signature" };
  }

  // Implement signature verification logic
  // This is a template - implement based on your needs
  return { valid: true };
}
