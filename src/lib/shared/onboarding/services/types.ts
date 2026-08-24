import type { AccountSetupProgress } from "../domain/account-setup-progress";

// --- From OnboardingPersister ---
/**
 * OnboardingPersister
 *
 * Contract for persisting onboarding completion status: app-wide
 * completion/skip status, profile setup progress and reminder policy, and the
 * What's New "last seen version" mark.
 *
 * Previously also carried per-module completion (a `modules` sub-object).
 * Removed 2026-07-19: it served the deprecated `ModuleOnboarding.svelte`
 * carousel. Its planned replacement, `TabIntro.svelte`'s local-only per-tab
 * dismissal, was never adopted by any tab and was itself deleted 2026-07-19
 * (see onboarding/README.md).
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
  /** Whether the first-ever 3D viewer guided setup has been shown */
  viewer3DIntroSeen: boolean;
  /** Durable profile-completion choices and reminder policy. */
  accountSetup: AccountSetupProgress;
}
