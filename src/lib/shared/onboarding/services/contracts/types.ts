// --- From OnboardingPersister ---
/**
 * OnboardingPersister
 *
 * Contract for persisting onboarding completion status.
 * Supports both app-wide and per-module onboarding.
 */

export interface OnboardingStatus {
  /** Whether app-wide onboarding is completed */
  appCompleted: boolean;
  /** Whether app-wide onboarding was skipped */
  appSkipped: boolean;
  /** When app-wide onboarding was completed (ISO string) */
  appCompletedAt: string | null;
  /** Per-module completion status */
  modules: {
    [moduleId: string]: {
      completed: boolean;
      completedAt: string | null;
    };
  };
  /** Last version user has seen in What's New modal */
  lastSeenVersion: string | null;
}

