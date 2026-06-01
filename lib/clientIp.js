/**
 * Resolve the real client IP behind the nginx reverse proxy.
 *
 * The app only listens on 127.0.0.1:3000 and is reached exclusively through
 * the bundled nginx, which sets:
 *   - X-Real-IP            = $remote_addr   (the TCP peer nginx saw)
 *   - X-Forwarded-For      = $proxy_add_x_forwarded_for
 *                            (client-supplied XFF + ", " + $remote_addr)
 *
 * A client CANNOT forge X-Real-IP because nginx overwrites it on every
 * request. It CAN, however, prepend arbitrary values to X-Forwarded-For —
 * nginx only *appends* the real peer at the end. Therefore the only
 * trustworthy entry in XFF is the LAST hop, never the first.
 *
 * Reading the raw XFF header (as the previous code did) let an attacker rotate
 * the spoofed prefix on every request to get a fresh rate-limit / lockout
 * bucket, completely defeating both. We fix that here.
 */
export function getClientIp(request) {
  // Most reliable: set by nginx, not forgeable by the client.
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // Fallback: trust only the LAST hop of X-Forwarded-For (added by nginx).
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  // Cloudflare (if ever placed in front) — also overwritten by the proxy.
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) {
    return cf.trim();
  }

  return "unknown";
}
