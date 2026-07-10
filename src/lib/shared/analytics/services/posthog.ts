/**
 * PostHog Analytics Integration
 *
 * Centralized PostHog initialization and utilities.
 * Replaces Firebase Analytics and custom activity tracking.
 *
 * Features enabled:
 * - Product Analytics (event tracking)
 * - Session Replay (watch user sessions)
 * - Feature Flags (with local evaluation)
 * - Error Tracking
 * - LLM Analytics (for Tika)
 */

import posthog from "posthog-js";
import { browser } from "$app/environment";

// `$env/dynamic/public` throws on module-eval in a worker (no globalThis
// sveltekit env object), which crashes the composition worker the moment it
// imports anything in this module's graph (authState -> posthog). Load it
// lazily so importing this module is worker-safe; the loader is only ever
// awaited from browser-guarded code paths, so the worker never fetches it.
type PublicEnv = Record<string, string | undefined>;
let _publicEnv: PublicEnv | null = null;
async function loadPublicEnv(): Promise<PublicEnv> {
  if (_publicEnv) return _publicEnv;
  ({ env: _publicEnv } = (await import("$env/dynamic/public")) as { env: PublicEnv });
  return _publicEnv;
}

let initialized = false;

/**
 * Initialize PostHog analytics.
 * Call once on app startup in +layout.svelte.
 */
export async function initPostHog(): Promise<void> {
  if (!browser) return;
  if (initialized) return;

  const env = await loadPublicEnv();
  if (!env.PUBLIC_POSTHOG_KEY) {
    console.warn("[PostHog] No API key found. Analytics disabled.");
    return;
  }

  posthog.init(env.PUBLIC_POSTHOG_KEY, {
    api_host: env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",

    // Capture pageviews automatically
    capture_pageview: true,
    capture_pageleave: true,

    // Session recording sends large payloads that trigger 413 errors on
    // localhost (CORS + Content Too Large). Only record in production.
    disable_session_recording: import.meta.env.DEV,

    // Autocapture clicks, form submissions, etc.
    autocapture: true,

    // Error tracking: capture every uncaught error, unhandled rejection, and
    // console.error as $exception events, tied to the identified user.
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    },

    // Feature flags - load on init for immediate availability
    bootstrap: {
      featureFlags: {},
    },

    // Persist user identity across sessions
    persistence: "localStorage+cookie",

    // Session recording configuration for accurate replay
    session_recording: {
      maskAllInputs: false, // We want to see what users type (except sensitive)
      maskInputOptions: {
        password: true,
      },
      // Tell rrweb to skip elements with this class - their subtree won't be
      // observed by MutationObserver, eliminating the 6x overhead on DOM-heavy
      // areas like the virtualized gallery grid. Blocked elements appear as
      // same-size placeholder rectangles in replay.
      blockClass: "ph-no-capture",
      collectFonts: true,
      inlineStylesheet: true,
    },

    // Load feature flags immediately
    loaded: (posthog) => {
      // Reload feature flags to ensure fresh state
      posthog.reloadFeatureFlags();

    },
  });

  initialized = true;
}

/**
 * Identify a user after authentication.
 * Call when user logs in or auth state changes.
 */
export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    username?: string;
    role?: string;
    createdAt?: Date;
    isPremium?: boolean;
    isTester?: boolean;
    isAdmin?: boolean;
  }
): void {
  if (!browser || !initialized) return;

  posthog.identify(userId, {
    email: properties?.email,
    name: properties?.name,
    username: properties?.username,
    role: properties?.role,
    created_at: properties?.createdAt?.toISOString(),
    is_premium: properties?.isPremium,
    is_tester: properties?.isTester,
    is_admin: properties?.isAdmin,
  });
}

/**
 * Reset user identity on logout.
 */
export function resetUser(): void {
  if (!browser || !initialized) return;
  posthog.reset();
}

/**
 * Capture a handled exception into PostHog error tracking.
 * Use for errors we catch and report ourselves (toasts, telemetry) so they
 * show up in the same per-user error timeline as uncaught ones.
 */
export function captureException(
  error: unknown,
  properties?: Record<string, unknown>
): void {
  if (!browser || !initialized) return;
  posthog.captureException(error, properties);
}

/**
 * Capture a custom event.
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!browser || !initialized) return;
  posthog.capture(eventName, properties);
}

/**
 * Get a feature flag value.
 * Returns the flag value or undefined if not set.
 */
export function getFeatureFlag(flagKey: string): boolean | string | undefined {
  if (!browser || !initialized) return undefined;
  return posthog.getFeatureFlag(flagKey);
}

/**
 * Check if a feature flag is enabled.
 * Returns true if the flag is enabled, false otherwise.
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!browser || !initialized) return false;
  return posthog.isFeatureEnabled(flagKey) ?? false;
}

/**
 * Get all feature flags for the current user.
 */
export function getAllFeatureFlags(): Record<string, boolean | string> {
  if (!browser || !initialized) return {};
  return posthog.featureFlags.getFlagVariants() || {};
}

/**
 * Reload feature flags from server.
 * Useful after user properties change.
 */
export function reloadFeatureFlags(): void {
  if (!browser || !initialized) return;
  posthog.reloadFeatureFlags();
}

/**
 * Set user properties without identifying.
 * Use for updating properties on an already-identified user.
 */
export function setUserProperties(
  properties: Record<string, unknown>
): void {
  if (!browser || !initialized) return;
  posthog.people.set(properties);
}

/**
 * Start a session recording manually.
 * Usually not needed as recording starts automatically.
 */
export function startSessionRecording(): void {
  if (!browser || !initialized) return;
  posthog.startSessionRecording();
}

/**
 * Stop session recording.
 */
export function stopSessionRecording(): void {
  if (!browser || !initialized) return;
  posthog.stopSessionRecording();
}

/**
 * Get the current session replay URL.
 * Useful for support tickets or bug reports.
 */
export async function getSessionReplayUrl(): Promise<string | null> {
  if (!browser || !initialized) return null;

  const sessionId = posthog.get_session_id();
  if (!sessionId) return null;

  const env = await loadPublicEnv();
  if (!env.PUBLIC_POSTHOG_PROJECT_ID) return null;

  return `https://us.posthog.com/project/${env.PUBLIC_POSTHOG_PROJECT_ID}/replay/${sessionId}`;
}

/**
 * Opt user out of tracking (for privacy preferences).
 */
export function optOut(): void {
  if (!browser || !initialized) return;
  posthog.opt_out_capturing();
}

/**
 * Opt user back into tracking.
 */
export function optIn(): void {
  if (!browser || !initialized) return;
  posthog.opt_in_capturing();
}

/**
 * Check if user has opted out.
 */
export function hasOptedOut(): boolean {
  if (!browser || !initialized) return false;
  return posthog.has_opted_out_capturing();
}

/**
 * Get the PostHog instance for advanced usage.
 * Prefer using the exported functions above.
 */
export function getPostHogInstance(): typeof posthog | null {
  if (!browser || !initialized) return null;
  return posthog;
}

// Re-export posthog for direct access if needed
export { posthog };
