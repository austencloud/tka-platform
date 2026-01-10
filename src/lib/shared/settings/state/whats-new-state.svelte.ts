/**
 * What's New Modal State
 *
 * Manages the "What's New" modal that shows after version updates.
 * Tracks whether user has seen the current version's changelog.
 *
 * Uses OnboardingPersister for Firebase sync so the seen version
 * persists across devices and browser data clearing.
 */

import type { AppVersion } from "$lib/features/feedback/domain/models/version-models";
import { container } from "$lib/shared/di";
import type { IOnboardingPersister } from "$lib/shared/onboarding/services/contracts/IOnboardingPersister";

const STORAGE_KEY = "tka-last-seen-version";

// Lazy service resolution to avoid circular dependencies
let _onboardingService: IOnboardingPersister | null = null;

function getOnboardingService(): IOnboardingPersister | null {
  if (_onboardingService) return _onboardingService;

  try {
    _onboardingService = container.items.onboardingPersister as IOnboardingPersister;
    return _onboardingService;
  } catch {
    return null;
  }
}

class WhatsNewState {
  isOpen = $state(false);
  version = $state<AppVersion | null>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);

  /**
   * Check if user has seen the current version.
   * Uses OnboardingPersister if available, falls back to localStorage.
   */
  hasSeenVersion(version: string): boolean {
    // Try service first for cached cloud data
    const service = getOnboardingService();
    if (service) {
      return service.hasSeenVersion(version);
    }

    // Fall back to localStorage for synchronous access
    if (typeof localStorage === "undefined") return true;
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    return lastSeen === version;
  }

  /**
   * Mark current version as seen.
   * Updates localStorage immediately and syncs to Firebase via OnboardingPersister.
   */
  markVersionAsSeen(version: string): void {
    if (typeof localStorage === "undefined") return;

    // Update localStorage immediately for synchronous access
    localStorage.setItem(STORAGE_KEY, version);

    // Sync to Firebase via service (non-blocking)
    const service = getOnboardingService();
    if (service) {
      void service.markVersionAsSeen(version);
    }
  }

  /**
   * Open the modal with version data
   */
  open(version: AppVersion) {
    this.version = version;
    this.isOpen = true;
  }

  /**
   * Close and mark as seen
   */
  close() {
    if (this.version) {
      this.markVersionAsSeen(this.version.version);
    }
    this.isOpen = false;
  }

  /**
   * Just close without marking as seen (for escape/backdrop)
   */
  dismiss() {
    if (this.version) {
      this.markVersionAsSeen(this.version.version);
    }
    this.isOpen = false;
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  setError(error: string | null) {
    this.error = error;
  }

  /**
   * Reset state (for testing)
   */
  reset() {
    this.isOpen = false;
    this.version = null;
    this.isLoading = false;
    this.error = null;
  }
}

export const whatsNewState = new WhatsNewState();
