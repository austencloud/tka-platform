/**
 * Onboarding Events
 *
 * Thin captureEvent wrappers for the app-entry / create-tutorial funnel
 * (offered -> accepted -> completed, or offered -> declined) plus first-run
 * completion. Keeping every call site behind these functions means the event
 * names and property shape live in one place instead of drifting per
 * call site, mirroring landing-analytics.ts's captureEvent wrappers.
 *
 * `source` distinguishes the normal automatic app-entry flow from a user
 * manually re-triggering the tutorial (Settings "replay tutorial").
 */
import { captureEvent } from "./posthog";

export type OnboardingEventSource = "app_entry" | "manual";

export interface OnboardingEventProps {
  source?: OnboardingEventSource;
  [key: string]: unknown;
}

/** The guided-build tutorial prompt was shown. */
export function logOnboardingTutorialOffered(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_tutorial_offered", props);
}

/** The user accepted the guided-build tutorial prompt (or replayed it). */
export function logOnboardingTutorialAccepted(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_tutorial_accepted", props);
}

/** The user declined the guided-build tutorial prompt. */
export function logOnboardingTutorialDeclined(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_tutorial_declined", props);
}

/** The guided-build tutorial ran to completion (all steps finished). */
export function logOnboardingTutorialCompleted(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_tutorial_completed", props);
}

/** The first-run wizard (display-name step) was completed. */
export function logOnboardingFirstRunCompleted(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_first_run_completed", props);
}
