/**
 * Auth Events
 *
 * The sign-in funnel: opened -> submitted -> signed up, or opened -> abandoned.
 *
 * This one is genuinely uninstrumented and genuinely not derivable. The modal
 * opens without navigating, so there is no `$pageview` to count, and the auth
 * method the user picked is not reliably readable from autocaptured DOM text.
 *
 * Context is captured once, at `opened`, and never re-threaded. AuthModal is
 * mounted from three hosts with two different open mechanisms, and its child
 * forms have no access to `page` or to "which CTA opened me". Passing
 * `from_page` down four component layers to satisfy a property contract isn't
 * worth it — correlate `submitted`/`abandoned` back to `opened` through
 * PostHog's automatic session and distinct_id instead.
 *
 * Thin `captureEvent` wrappers, modeled on `services/onboarding-events.ts`. No
 * DI, no `logActivity` — these fire for anonymous visitors who have no activity
 * log to write to. Dev gating is inherited from `captureEvent`.
 *
 * Spec: docs/architecture/landing-analytics-taxonomy.md §4
 */

import { captureEvent } from "$lib/shared/analytics/services/posthog";

/** Which entry point opened the modal. */
export type AuthCta = "header_desktop_signin" | "header_mobile_signin";

/**
 * Is a tracked sign-in flow currently in progress?
 *
 * This gate exists because the auth FORMS are shared and the funnel is not.
 * `SocialAuthCompact` and `EmailAuthTabs` (wrapping EmailPasswordAuth /
 * EmailLinkAuth) are mounted from three hosts, and `AuthModal` from two:
 *
 *   - SiteHeader          -> openSignIn(), fires `auth_modal_opened`  [tracked]
 *   - MainApplication     -> the anonymous-guest nudge modal          [untracked]
 *   - AuthSheet           -> the `?sheet=auth` deep link (footer link) [untracked]
 *   - AuthPrompt          -> Settings > Profile, signed-out state      [untracked]
 *
 * Only the first fires `opened`. Without this gate the other three would emit
 * `submitted`/`abandoned` with no matching `opened`, so the funnel's first step
 * would read smaller than its second — a funnel that is not merely incomplete
 * but actively wrong. Arming on `opened` and gating everything downstream on it
 * keeps the three steps describing one population, by construction, with no
 * prop threaded through four component layers and no edits to the untracked
 * hosts (which must stay free to mount these forms without opting into a
 * funnel they never entered).
 *
 * The taxonomy (§4) names the `?sheet=auth` path as explicitly out of scope and
 * says to trace it before adding it. This gate is what makes "out of scope"
 * true in code rather than in intent.
 */
let funnelArmed = false;

/** True while a SiteHeader-initiated sign-in flow is open. */
export function isAuthFunnelArmed(): boolean {
  return funnelArmed;
}

/** Ends the tracked flow, whatever its outcome. Idempotent. */
export function disarmAuthFunnel(): void {
  funnelArmed = false;
}

export type AuthMethod =
  | "google"
  | "google_one_tap"
  | "facebook"
  | "instagram"
  | "magic_link"
  | "password";

/** Only the email/password form distinguishes these; social auth does not. */
export type AuthMode = "signin" | "signup";

export type AuthDismiss = "close_button" | "backdrop_or_escape";

/**
 * The sign-in modal was opened. `page` is the route id the user opened it from.
 * This is the ONLY thing that arms the funnel — see `funnelArmed` above.
 */
export function trackAuthModalOpened(page: string, cta: AuthCta): void {
  funnelArmed = true;
  captureEvent("auth_modal_opened", { page, cta });
}

/** A credential was submitted — the last step before the provider takes over.
 *  Silent unless a tracked flow is open, so the shared forms can be mounted
 *  from the untracked hosts without polluting the funnel. */
export function trackAuthModalSubmitted(
  method: AuthMethod,
  authMode?: AuthMode
): void {
  if (!funnelArmed) return;
  captureEvent("auth_modal_submitted", {
    method,
    ...(authMode ? { auth_mode: authMode } : {}),
  });
}

/** The modal closed without a submission. Gated for the same reason. */
export function trackAuthModalAbandoned(dismiss: AuthDismiss): void {
  if (!funnelArmed) return;
  captureEvent("auth_modal_abandoned", { dismiss });
}
