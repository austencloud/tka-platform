/**
 * IOnboardingPersister
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

export interface IOnboardingPersister {
  /**
   * Load onboarding status from persistent storage.
   * For authenticated users, loads from Firebase.
   * Falls back to localStorage for anonymous users.
   */
  loadStatus(): Promise<OnboardingStatus>;

  /**
   * Save complete onboarding status.
   */
  saveStatus(status: OnboardingStatus): Promise<void>;

  /**
   * Check if a specific module's onboarding is completed.
   * Uses cached status if available, otherwise loads from storage.
   */
  hasCompletedModule(moduleId: string): boolean;

  /**
   * Mark a module's onboarding as completed.
   */
  markModuleCompleted(moduleId: string): Promise<void>;

  /**
   * Reset a module's onboarding status (for replay).
   */
  resetModule(moduleId: string): Promise<void>;

  /**
   * Check if app-wide onboarding is completed.
   */
  hasCompletedApp(): boolean;

  /**
   * Mark app-wide onboarding as completed.
   */
  markAppCompleted(): Promise<void>;

  /**
   * Mark app-wide onboarding as skipped.
   */
  markAppSkipped(): Promise<void>;

  /**
   * Reset all onboarding status.
   */
  resetAll(): Promise<void>;

  /**
   * Subscribe to real-time updates (for cross-device sync).
   * Returns unsubscribe function.
   */
  subscribe(callback: (status: OnboardingStatus) => void): Promise<() => void>;

  /**
   * Sync localStorage to Firebase when user authenticates.
   * Merges local progress with cloud progress, keeping most complete state.
   */
  syncLocalToCloud(): Promise<void>;

  // =========================================================================
  // What's New Version Tracking
  // =========================================================================

  /**
   * Check if user has seen the given version in What's New.
   */
  hasSeenVersion(version: string): boolean;

  /**
   * Mark a version as seen in What's New.
   */
  markVersionAsSeen(version: string): Promise<void>;

  /**
   * Get the last seen version (for debugging/display).
   */
  getLastSeenVersion(): string | null;
}
