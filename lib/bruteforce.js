/**
 * Brute-force protection for admin authentication.
 *
 * The admin "login" is simply any authenticated request (the UI probes
 * GET /api/files with the x-admin-password header). There is a single shared
 * password and no username, so the only thing standing between an attacker and
 * the password is request throttling. The generic per-endpoint rate limiter
 * caps request *volume*, but this module specifically tracks *failed auth* per
 * client IP and applies an escalating lockout, so a credential-guessing attack
 * is stopped long before it can make a meaningful number of attempts.
 *
 * State is in-memory (per process). For a single-container deployment that is
 * sufficient; behind multiple replicas move this to Redis.
 */
import { getClientIp } from "@/lib/clientIp";
import { logSecurityEvent } from "@/lib/security";

const MAX_FAILURES = 8; // failures allowed inside the window before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window for counting failures
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // first lockout duration
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // cap escalating lockouts at 24h

// key (ip) -> { failures: number[], lockedUntil: number, lockLevel: number }
const attempts = new Map();

let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60000) return;
  lastSweep = now;
  for (const [key, rec] of attempts) {
    const recentFailures = rec.failures.filter((ts) => now - ts < WINDOW_MS);
    if (recentFailures.length === 0 && (!rec.lockedUntil || rec.lockedUntil < now)) {
      attempts.delete(key);
    } else {
      rec.failures = recentFailures;
    }
  }
}

function getRecord(key) {
  if (!attempts.has(key)) {
    attempts.set(key, { failures: [], lockedUntil: 0, lockLevel: 0 });
  }
  return attempts.get(key);
}

/**
 * Returns { locked, retryAfter } where retryAfter is seconds.
 * Call this BEFORE checking the password.
 */
export function checkLockout(request) {
  sweep();
  const key = getClientIp(request);
  const rec = attempts.get(key);
  if (!rec) return { locked: false };

  const now = Date.now();
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return {
      locked: true,
      retryAfter: Math.ceil((rec.lockedUntil - now) / 1000),
    };
  }
  return { locked: false };
}

/**
 * Record a failed authentication attempt. Triggers (and escalates) a lockout
 * once MAX_FAILURES is reached inside the window.
 */
export function recordFailure(request, endpoint) {
  const key = getClientIp(request);
  const rec = getRecord(key);
  const now = Date.now();

  rec.failures = rec.failures.filter((ts) => now - ts < WINDOW_MS);
  rec.failures.push(now);

  logSecurityEvent("AUTH_FAILED", { ip: key, endpoint, failures: rec.failures.length });

  if (rec.failures.length >= MAX_FAILURES) {
    // Escalating lockout: 15m, 30m, 60m ... capped at 24h.
    const lockMs = Math.min(BASE_LOCKOUT_MS * 2 ** rec.lockLevel, MAX_LOCKOUT_MS);
    rec.lockedUntil = now + lockMs;
    rec.lockLevel += 1;
    rec.failures = []; // reset the counter for the next window after lockout
    logSecurityEvent("AUTH_LOCKOUT", {
      ip: key,
      endpoint,
      lockoutSeconds: Math.ceil(lockMs / 1000),
      level: rec.lockLevel,
    });
  }
}

/**
 * Record a successful authentication — clears the failure counter for that IP
 * but keeps the escalation level so a repeat offender re-locks faster.
 */
export function recordSuccess(request) {
  const key = getClientIp(request);
  const rec = attempts.get(key);
  if (rec) {
    rec.failures = [];
    rec.lockedUntil = 0;
  }
}
