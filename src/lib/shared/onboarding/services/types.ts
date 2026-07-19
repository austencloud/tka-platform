// --- From OnboardingPersister ---
/**
 * OnboardingPersister
 *
 * Contract for persisting onboarding completion status: app-wide
 * completion/skip status, and the What's New "last seen version" mark.
 *
 * Previously also carried per-module completion (a `modules` sub-object).
 * Removed 2026-07-19 — it served the deprecated `ModuleOnboarding.svelte`
 * carousel and had zero remaining callers once TabIntro.svelte's
 * local-only per-tab dismissal replaced it.
 */

export interface OnboardingStatus {
  /** Whether app-wide onboarding is completed */
  appCompleted: boolean;
  /** Whether app-wide onboarding was skipped */
  appSkipped: boolean;
  /** When app-wide onboarding was completed (ISO string) */
  appCompletedAt: string | null;
  /** Last version user has seen in What's New modal */
  lastSeenVersion: string | null;
}

