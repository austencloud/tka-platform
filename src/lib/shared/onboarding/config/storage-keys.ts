/**
 * Onboarding Storage Keys
 *
 * Centralized storage key constants for onboarding persistence.
 *
 * NOTE: localStorage is used for synchronous access (to avoid UI flash).
 * The OnboardingPersister syncs localStorage with Firebase for
 * authenticated users. Use `markModuleOnboardingComplete()` which calls
 * the service when available.
 */

import { getOnboardingPersister } from "$lib/shared/onboarding/get-onboarding-persister";
import type { OnboardingPersister } from "../services/onboarding-persister";
import {
  safeLocalStorageSetItem,
  removeLocalStorageItem,
} from "$lib/shared/foundation/services/storage-manager";

// Lazy service resolution to avoid circular dependencies
let _onboardingService: OnboardingPersister | null = null;

function getOnboardingService(): OnboardingPersister | null {
  if (_onboardingService) return _onboardingService;

  try {
    _onboardingService = getOnboardingPersister();
    return _onboardingService;
  } catch {
    return null;
  }
}

// ============================================================================
// APP-WIDE ONBOARDING
// ============================================================================

/** localStorage key for app-wide onboarding completion status */
export const ONBOARDING_COMPLETED_KEY = "tka-onboarding-completed";

/** localStorage key for app-wide onboarding completion timestamp */
export const ONBOARDING_COMPLETED_AT_KEY = "tka-onboarding-completed-at";

/** localStorage key for app-wide onboarding skip (user chose to skip) */
export const ONBOARDING_SKIPPED_KEY = "tka-onboarding-skipped";

// ============================================================================
// PER-MODULE ONBOARDING
// ============================================================================

/** Generate localStorage key for module onboarding completion */
export function getModuleOnboardingKey(moduleId: string): string {
  return `tka-${moduleId}-onboarding-completed`;
}

/** Generate localStorage key for module onboarding timestamp */
export function getModuleOnboardingTimestampKey(moduleId: string): string {
  return `tka-${moduleId}-onboarding-completed-at`;
}

/** Pre-defined keys for each module */
export const MODULE_ONBOARDING_KEYS = {
  browse: "tka-browse-onboarding-completed",
  learn: "tka-learn-onboarding-completed",
  compose: "tka-compose-onboarding-completed",
  train: "tka-train-onboarding-completed",
  library: "tka-library-onboarding-completed",
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if module onboarding has been completed
 */
export function hasCompletedModuleOnboarding(moduleId: string): boolean {
  const key = getModuleOnboardingKey(moduleId);
  return localStorage.getItem(key) === "true";
}

/**
 * Mark module onboarding as completed.
 * Updates localStorage immediately (synchronous) and syncs to Firebase (async).
 */
export function markModuleOnboardingComplete(moduleId: string): void {
  // Always update localStorage immediately for synchronous access. Guarded
  // (safeLocalStorageSetItem swallows a quota/private-browsing throw) so a
  // full local store never blocks the Firebase sync below.
  const key = getModuleOnboardingKey(moduleId);
  const timestampKey = getModuleOnboardingTimestampKey(moduleId);
  safeLocalStorageSetItem(key, "true");
  safeLocalStorageSetItem(timestampKey, new Date().toISOString());

  // Also sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.markModuleCompleted(moduleId);
  }
}

/**
 * Reset module onboarding (for testing/replaying)
 */
export function resetModuleOnboarding(moduleId: string): void {
  const key = getModuleOnboardingKey(moduleId);
  const timestampKey = getModuleOnboardingTimestampKey(moduleId);
  removeLocalStorageItem(key);
  removeLocalStorageItem(timestampKey);

  // Also sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.resetModule(moduleId);
  }
}

/**
 * Reset all onboarding (app-wide + all modules)
 */
export function resetAllOnboarding(): void {
  // App-wide
  removeLocalStorageItem(ONBOARDING_COMPLETED_KEY);
  removeLocalStorageItem(ONBOARDING_COMPLETED_AT_KEY);
  removeLocalStorageItem(ONBOARDING_SKIPPED_KEY);

  // Per-module
  Object.values(MODULE_ONBOARDING_KEYS).forEach((key) => {
    removeLocalStorageItem(key);
    removeLocalStorageItem(key.replace("-completed", "-completed-at"));
  });

  // Also sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.resetAll();
  }
}

/**
 * Sync onboarding status from Firebase to localStorage.
 * Call this when a user authenticates to load their cloud-stored onboarding progress.
 */
export async function syncOnboardingFromCloud(): Promise<void> {
  const service = getOnboardingService();
  if (service) {
    await service.loadStatus();
  }
}

/**
 * Sync onboarding status from localStorage to Firebase.
 * Call this when a user authenticates to merge their local progress with cloud.
 */
export async function syncOnboardingToCloud(): Promise<void> {
  const service = getOnboardingService();
  if (service) {
    await service.syncLocalToCloud();
  }
}
