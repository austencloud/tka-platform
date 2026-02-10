/**
 * Reusable rate limit guard for API endpoints.
 *
 * Call at the top of a request handler. Returns null if allowed,
 * or a 429 Response if the caller has exceeded the limit.
 *
 * Usage:
 *   const blocked = withRateLimit(event, RATE_LIMITS.AI_CHAT, 'user');
 *   if (blocked) return blocked;
 */

import type { RequestEvent } from "@sveltejs/kit";
import {
  checkRateLimit,
  rateLimitResponse,
  type RateLimitConfig,
} from "./rate-limiter";

/**
 * Apply rate limiting to a request.
 *
 * @param event - SvelteKit request event
 * @param config - Rate limit preset (from RATE_LIMITS)
 * @param keyType - 'ip' uses client IP, 'user' requires a uid string
 * @param uid - Required when keyType is 'user'
 * @returns null if allowed, 429 Response if blocked
 */
export function withRateLimit(
  event: RequestEvent,
  config: RateLimitConfig,
  keyType: "ip",
): Response | null;
export function withRateLimit(
  event: RequestEvent,
  config: RateLimitConfig,
  keyType: "user",
  uid: string,
): Response | null;
export function withRateLimit(
  event: RequestEvent,
  config: RateLimitConfig,
  keyType: "ip" | "user",
  uid?: string,
): Response | null {
  const prefix = event.url.pathname;
  const identifier =
    keyType === "user" && uid
      ? `${prefix}:user:${uid}`
      : `${prefix}:ip:${event.getClientAddress()}`;

  const result = checkRateLimit(identifier, config);
  if (!result.allowed) {
    return rateLimitResponse(result.resetAt);
  }
  return null;
}
