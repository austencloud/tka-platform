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
import type {
  CaptureOptions,
  PostHogInterface,
  BeforeSendFn,
  CaptureResult,
} from "posthog-js";
import { browser } from "$app/environment";
import * as staticPublicEnv from "$env/static/public";
import { getDeviceId } from "$lib/shared/foundation/services/device-id";

// Capacitor serves a static bundle and has no server route for SvelteKit's
// /_app/env.js. Build-time public constants work in the WebView and remain safe
// when this module appears in a worker import graph. Reading through the module
// namespace also lets hosts omit optional PostHog values without failing the
// build on a missing named export.
const publicEnv = staticPublicEnv as Record<string, string | undefined>;

let initialized = false;
let initializationPromise: Promise<void> | null = null;
export type PostHogReadyClient = PostHogInterface;
type PostHogReadyListener = (instance: PostHogReadyClient) => void;
const postHogReadyListeners = new Set<PostHogReadyListener>();

/**
 * Run setup that must land inside PostHog's `loaded` callback, before its
 * initial pageview is captured. Already-ready callers run synchronously.
 */
export function onPostHogReady(listener: PostHogReadyListener): () => void {
  if (!browser) return () => {};
  if (initialized) {
    listener(posthog);
    return () => {};
  }
  postHogReadyListeners.add(listener);
  return () => postHogReadyListeners.delete(listener);
}

function notifyPostHogReady(instance: PostHogReadyClient): void {
  const listeners = [...postHogReadyListeners];
  postHogReadyListeners.clear();
  for (const listener of listeners) listener(instance);
}

// Whether this page load ever identified a real user to PostHog. resetUser()
// reads it so an ungated call can't churn the identity of a visitor who was
// never identified in the first place.
let identified = false;

/**
 * Has PostHog already restored an identified person from its own storage?
 *
 * Bootstrapping a distinct_id overwrites whatever PostHog had persisted, so for
 * a signed-in user it would knock them back to anonymous and re-fire $identify
 * on every page load. Anonymous visitors have nothing worth preserving — their
 * stored id is a random uuid — so those we happily overwrite with the stable
 * device id.
 *
 * Reads PostHog's own persistence key (`ph_<token>_posthog`, the default when
 * `persistence_name` is unset) and its `$user_state` property. Both verified
 * against posthog-js 1.341.0; if either ever changes shape this returns false
 * and we simply bootstrap, which is the safe direction.
 */
function hasIdentifiedPostHogPerson(token: string): boolean {
  const raw = localStorage.getItem(`ph_${token}_posthog`);
  if (!raw) return false;
  const stored = JSON.parse(raw) as { $user_state?: string };
  return stored.$user_state === "identified";
}

/**
 * The distinct_id to pin an anonymous visitor to, or undefined to let PostHog
 * use what it already has.
 *
 * Why: PostHog's own anonymous id is random and disposable — a reset() or a
 * cleared localStorage mints a brand-new one, and the same human comes back as
 * a second "user". Seeding it from our persistent device UUID makes one browser
 * one identity, so a stray reset heals on the next page load instead of
 * permanently forking the person.
 */
function resolveBootstrapDistinctId(token: string): string | undefined {
  try {
    if (hasIdentifiedPostHogPerson(token)) return undefined;
    return getDeviceId();
  } catch {
    // Storage blocked (private browsing, hardened settings) or unparseable —
    // fall back to PostHog's own id rather than failing init over analytics.
    return undefined;
  }
}

/**
 * Contract verified against the installed posthog-js@1.341.0 (matches the
 * `^1.335.3` range in package.json), not trusted from memory:
 *
 *   // @posthog/types/dist/capture.d.ts:64
 *   export type BeforeSendFn = (cr: CaptureResult | null) => CaptureResult | null;
 *   // @posthog/types/dist/posthog-config.d.ts:1061
 *   before_send?: BeforeSendFn | BeforeSendFn[];
 *
 * And the dispatcher itself (posthog-js/dist/main.js, function `cs`) drops the
 * event whenever the returned value is nullish — `null` and a bare `undefined`
 * (an implicit return) are indistinguishable to it. There is no exception and
 * no build-time signal for a branch that forgets to return: it just silently
 * stops sending. So every non-drop branch below returns `event` explicitly,
 * never falls off the end of the function.
 *
 * Three console.error strings confirmed as SDK/browser chatter, not app bugs —
 * they were 80%+ of $exception volume on the Instagram-referral session that
 * prompted this audit (docs/architecture/in-app-browser-path.md), burying real
 * errors under noise nobody could act on. This is a DENYLIST: only an event
 * matching one of these three patterns is dropped, everything else — including
 * event shapes this list has never seen — passes through untouched. An
 * allowlist here would silently kill unknown-but-legitimate event types.
 */
const EXCEPTION_NOISE = [
  // Firestore's multi-tab lease election, thrown by a secondary tab that lost
  // the primary-client negotiation. This was pinned to three action names on
  // the claim that they were the only callers of the readwrite-primary path;
  // grepping the installed SDK (@firebase/firestore 4.14.1,
  // dist/common-7a7519be.esm.js) says otherwise — runTransaction(_,
  // "readwrite-primary") is reached by "Acknowledge batch", "Apply remote
  // event", "Backfill Indexes", "Collect garbage", "Reject batch" and
  // "maybeGarbageCollectMultiClientState", plus "Release target" when its
  // conditional picks readwrite-primary. The two busiest (a queued write being
  // acknowledged, a live onSnapshot applying an update) were the ones missing,
  // so the filter did nothing for the common case. Every caller of this path is
  // SDK background maintenance by construction, never app code, so match the
  // message shape rather than re-enumerating a list that drifts with the SDK.
  /Failed to obtain primary lease for action '[^']+'/,
  // Browser-native scheduling backpressure, permitted by the spec.
  /ResizeObserver loop completed with undelivered notifications/,
  // iOS Safari has no FCM support. Guarded at the call site now
  // (foreground-message-handler.ts), this covers any path that still reaches
  // the SDK's own feature-detection throw.
  /messaging\/unsupported-browser/,
];

/**
 * PostHog `before_send` hook: drops known-noise `$exception` events before
 * they leave the browser. Every other event — including every other
 * `$exception` — passes through unchanged. See the contract note above before
 * touching the early returns; each one must `return event`, never fall through.
 */
export const dropKnownNoise: BeforeSendFn = (event: CaptureResult | null) => {
  // Null in means null out — a prior before_send already rejected it, not
  // ours to override.
  if (!event) return event;
  if (event.event !== "$exception") return event;

  const list = event.properties?.$exception_list;
  if (!Array.isArray(list)) return event;

  // Only the root exception is tested, never the whole chain. posthog's
  // ErrorPropertiesBuilder.convertToExceptionList flattens an Error's .cause
  // chain into this same array — root first, then causes — so a `.some()` over
  // all of it would drop a real, actionable report whenever a noisy SDK error
  // happened to be attached as its cause. Losing the outer "Sequence save
  // failed" to a Firestore lease error nested underneath is exactly the silent
  // blackout this filter must not cause. Noise arrives unwrapped, at index 0.
  const root = list[0];
  const isNoise =
    typeof root?.value === "string" &&
    EXCEPTION_NOISE.some((pattern) => pattern.test(root.value));
  return isNoise ? null : event;
};

/**
 * Initialize PostHog analytics.
 * Call once on app startup in +layout.svelte.
 */
export function initPostHog(): Promise<void> {
  if (!browser) return Promise.resolve();

  // The in-flight check MUST come before the `initialized` check.
  // `initializePostHog` is async but never awaits internally, so its body —
  // including `initialized = true` — runs synchronously on the first call.
  // `.finally()` still defers, so `initializationPromise` is genuinely pending
  // at that moment. Testing `initialized` first therefore sent every concurrent
  // caller down the fast path and handed each a fresh resolved promise instead
  // of the shared one, defeating the point of sharing it.
  if (initializationPromise) return initializationPromise;
  if (initialized) return Promise.resolve();

  initializationPromise = initializePostHog().finally(() => {
    initializationPromise = null;
  });
  return initializationPromise;
}

async function initializePostHog(): Promise<void> {
  const env = publicEnv;
  if (!env.PUBLIC_POSTHOG_KEY) {
    console.warn("[PostHog] No API key found. Analytics disabled.");
    return;
  }

  // Dev sessions poisoned the project: 80% of $exception volume was localhost
  // Vite HMR noise, and dev clicks/pageviews skewed every user metric. In dev,
  // keep PostHog alive for feature flags but capture nothing.
  const captureEnabled = !import.meta.env.DEV;

  posthog.init(env.PUBLIC_POSTHOG_KEY, {
    api_host: env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",

    // Capture the initial load and SvelteKit history navigation (prod only).
    capture_pageview: captureEnabled ? "history_change" : false,
    capture_pageleave: captureEnabled,

    // Keep the field-performance evidence owned by PostHog's native event.
    // Setting this in the client prevents a project toggle from silently
    // removing LCP, INP, or CLS from the SEO scorecard.
    capture_performance: {
      web_vitals: captureEnabled,
      web_vitals_allowed_metrics: ["LCP", "INP", "CLS"],
    },

    // Session recording sends large payloads that trigger 413 errors on
    // localhost (CORS + Content Too Large). Only record in production.
    disable_session_recording: import.meta.env.DEV,

    // Autocapture clicks, form submissions, etc. (prod only)
    autocapture: captureEnabled,

    // Error tracking: capture every uncaught error, unhandled rejection, and
    // console.error as $exception events, tied to the identified user.
    // Prod only — in dev this hoovered up HMR errors and mid-edit states.
    capture_exceptions: captureEnabled && {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    },

    // Feature flags - load on init for immediate availability.
    // distinctID pins an anonymous visitor to this browser's device UUID so a
    // reset or a storage wipe still lands on the same person. Left undefined
    // for an already-identified user (see resolveBootstrapDistinctId), and
    // posthog-js skips the whole bootstrap-identity path when it is undefined.
    bootstrap: {
      featureFlags: {},
      distinctID: resolveBootstrapDistinctId(env.PUBLIC_POSTHOG_KEY),
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

    // Registered unconditionally (not gated on captureEnabled): capture_exceptions
    // is already false in dev, so this never sees a $exception there anyway, and
    // the hook must be present the moment prod traffic starts flowing.
    before_send: dropKnownNoise,

    // Load feature flags immediately
    loaded: (posthog) => {
      // Scan attribution must be registered here, before posthog-js schedules
      // the initial $pageview immediately after this callback returns.
      notifyPostHogReady(posthog);
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

  identified = true;
}

/**
 * Reset user identity on logout.
 *
 * Only ever valid after a real sign-in. reset() mints a fresh distinct_id AND a
 * fresh session_id, so calling it for a visitor who was never identified splits
 * one anonymous person — and one session recording — in two for no gain. That
 * is exactly what broke card-scan attribution: the auth listener's "no user"
 * branch fired on every page load for every logged-out visitor. Callers gate on
 * a genuine signed-in → signed-out transition; this guard makes an ungated call
 * a no-op instead of a regression.
 */
export function resetUser(): void {
  if (!browser || !initialized) return;
  if (!identified) return;

  identified = false;
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
  if (!browser || !initialized || import.meta.env.DEV) return;
  posthog.captureException(error, properties);
}

/**
 * Capture a custom event. No-op in dev — localhost sessions were polluting
 * every product metric (sequence_save, session_start, module_view).
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>,
  options?: CaptureOptions
): void {
  if (!browser || !initialized || import.meta.env.DEV) return;
  captureEventWithPostHog(posthog, eventName, properties, options);
}

/** Deliver events queued before `initialized` flips inside the loaded hook. */
export function captureEventWithPostHog(
  instance: PostHogReadyClient,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: CaptureOptions
): void {
  if (!browser || import.meta.env.DEV) return;
  // Analytics is an observer, never a participant. Every capture in the app
  // funnels through here, and several sit on the critical path of a flow that
  // must not break: trackCheckoutStarted fires between the Stripe session
  // resolving and the redirect, inside the caller's try/catch — an SDK throw
  // there would surface to the buyer as "checkout isn't available" while a
  // perfectly good Stripe URL sat in hand. Same shape in BuyButton (throw =
  // item never added) and CartButton (throw = drawer never opens). Swallowing
  // here means no present or future call site has to remember to defend
  // itself, and a broken metric can never cost a conversion.
  try {
    instance.capture(eventName, properties, options);
  } catch (error) {
    console.warn(`[posthog] capture failed for "${eventName}"`, error);
  }
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
export function setUserProperties(properties: Record<string, unknown>): void {
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

  const env = publicEnv;
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
