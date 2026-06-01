// In-memory rate limiter (consider using Redis for multi-instance deployments).
import { getClientIp } from "@/lib/clientIp";

const limiterStore = new Map();

// Periodically evict stale buckets so the Map cannot grow unbounded from
// rotating source IPs. Runs at most once per minute, lazily on each call.
let lastSweep = Date.now();
function sweep(windowMs) {
  const now = Date.now();
  if (now - lastSweep < 60000) return;
  lastSweep = now;
  for (const [key, timestamps] of limiterStore) {
    const valid = timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      limiterStore.delete(key);
    } else {
      limiterStore.set(key, valid);
    }
  }
}

export function createRateLimiter(maxRequests = 5, windowMs = 60000) {
  return function rateLimiter(request) {
    // Use the trusted, non-spoofable client IP. Reading the raw
    // X-Forwarded-For header would let attackers rotate the bucket key.
    const key = getClientIp(request);

    const now = Date.now();
    sweep(windowMs);

    if (!limiterStore.has(key)) {
      limiterStore.set(key, []);
    }

    const timestamps = limiterStore.get(key);

    // Remove old entries outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return {
        limited: true,
        retryAfter: Math.ceil((validTimestamps[0] + windowMs - now) / 1000),
      };
    }

    validTimestamps.push(now);
    limiterStore.set(key, validTimestamps);

    return { limited: false };
  };
}
