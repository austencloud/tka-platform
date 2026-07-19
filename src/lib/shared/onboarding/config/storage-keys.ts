/**
 * Onboarding Storage Keys
 *
 * Centralized storage key constants for onboarding persistence.
 *
 * NOTE: localStorage is used for synchronous access (to avoid UI flash).
 * The OnboardingPersister syncs localStorage with Firebase for authenticated
 * users, for two things only: app-wide completion/skip status, and the
 * What's New "last seen version" high-water mark (see
 * syncOnboardingFromCloud/syncOnboardingToCloud below).
 *
 * There is no per-module or per-tab onboarding tracking here. The per-module
 * surface (markModuleOnboardingComplete/hasCompletedModuleOnboarding + a
 * Firestore `modules` sub-object) was removed 2026-07-19 as dead code: it
 * served the old `ModuleOnboarding.svelte` carousel, which was deprecated in
 * favor of a planned `TabIntro.svelte` per-tab dismissal. That replacement
 * was never adopted by any tab (zero mount points from the day it shipped)
 * and was itself deleted 2026-07-19 (see onboarding/README.md).
 */

import { getOnboardingPersister } from "$lib/shared/onboarding/get-onboarding-persister";
import type { OnboardingPersister } from "../services/onboarding-persister";

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
// CLOUD SYNC
// ============================================================================

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
