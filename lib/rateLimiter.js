// In-memory rate limiter (consider using Redis in production)
const limiterStore = new Map();

export function createRateLimiter(maxRequests = 5, windowMs = 60000) {
  return function rateLimiter(request) {
    const identifier = request.headers.get("x-forwarded-for") || 
                       request.headers.get("cf-connecting-ip") ||
                       "unknown";
    
    const now = Date.now();
    const key = `${identifier}`;
    
    if (!limiterStore.has(key)) {
      limiterStore.set(key, []);
    }
    
    const timestamps = limiterStore.get(key);
    
    // Remove old entries outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    if (validTimestamps.length >= maxRequests) {
      return {
        limited: true,
        retryAfter: Math.ceil((validTimestamps[0] + windowMs - now) / 1000)
      };
    }
    
    validTimestamps.push(now);
    limiterStore.set(key, validTimestamps);
    
    return { limited: false };
  };
}
