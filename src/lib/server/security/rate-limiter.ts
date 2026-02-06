/**
 * Simple in-memory rate limiter for API endpoints
 *
 * Tracks request counts per IP/user with sliding window.
 * Note: This is reset on server restart. For production at scale,
 * consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Result with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  const entry = rateLimitStore.get(key);

  // No entry or expired window - create new
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Create a rate limit response with appropriate headers
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      code: "rate_limited",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

// Preset configurations for common use cases
export const RATE_LIMITS = {
  /** Sensitive account operations: 5 requests per 15 minutes */
  ACCOUNT_SENSITIVE: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  /** Authentication attempts: 10 requests per 15 minutes */
  AUTH_ATTEMPTS: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  /** General API: 100 requests per minute */
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
