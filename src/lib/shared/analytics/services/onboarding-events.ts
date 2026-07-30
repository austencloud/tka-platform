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

/** The guest first-save keep-your-work prompt (AuthNudge) was shown, after markPresented(). */
export function logOnboardingGuestFirstSavePromptShown(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_shown", props);
}

/** The user chose "Create account" from the guest first-save prompt. */
export function logOnboardingGuestFirstSavePromptAccepted(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_accepted", props);
}

/** The user dismissed the guest first-save prompt without acting. */
export function logOnboardingGuestFirstSavePromptDeclined(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_declined", props);
}

/** The user chose "Log in" (existing account) from the guest first-save prompt. */
export function logOnboardingGuestFirstSavePromptLogin(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_login", props);
}

// The first-session starter (SP3b) and its four
// onboarding_first_sequence_starter_* events were removed 2026-07-29.
