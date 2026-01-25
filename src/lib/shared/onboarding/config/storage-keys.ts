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

import { container } from "$lib/shared/di";
import type { IOnboardingPersister } from "../services/contracts/IOnboardingPersister";

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
// SIDEBAR TOUR (Desktop)
// ============================================================================

/** localStorage key for sidebar tour completion status */
export const SIDEBAR_TOUR_COMPLETED_KEY = "tka-sidebar-tour-completed";

/** localStorage key for sidebar tour skip (user chose "Browse on my own") */
export const SIDEBAR_TOUR_SKIPPED_KEY = "tka-sidebar-tour-skipped";

/**
 * Check if sidebar tour has been completed or skipped.
 * Uses OnboardingPersister if available, falls back to localStorage.
 */
export function hasCompletedSidebarTour(): boolean {
  // Try service first for cached cloud data
  const service = getOnboardingService();
  if (service) {
    return service.hasCompletedSidebarTour();
  }

  // Fall back to localStorage for synchronous access
  if (typeof localStorage === "undefined") return true; // SSR safety
  return (
    localStorage.getItem(SIDEBAR_TOUR_COMPLETED_KEY) === "true" ||
    localStorage.getItem(SIDEBAR_TOUR_SKIPPED_KEY) === "true"
  );
}

/**
 * Mark sidebar tour as completed.
 * Updates localStorage immediately and syncs to Firebase via OnboardingPersister.
 */
export function markSidebarTourCompleted(): void {
  if (typeof localStorage === "undefined") return;

  // Update localStorage immediately for synchronous access
  localStorage.setItem(SIDEBAR_TOUR_COMPLETED_KEY, "true");
  localStorage.setItem(
    `${SIDEBAR_TOUR_COMPLETED_KEY}-at`,
    new Date().toISOString()
  );

  // Sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.markSidebarTourCompleted();
  }
}

/**
 * Mark sidebar tour as skipped (user chose "Browse on my own").
 * Updates localStorage immediately and syncs to Firebase via OnboardingPersister.
 */
export function markSidebarTourSkipped(): void {
  if (typeof localStorage === "undefined") return;

  // Update localStorage immediately
  localStorage.setItem(SIDEBAR_TOUR_SKIPPED_KEY, "true");

  // Sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.markSidebarTourSkipped();
  }
}

/**
 * Reset sidebar tour (for testing/replaying).
 * Clears localStorage and syncs to Firebase via OnboardingPersister.
 */
export function resetSidebarTour(): void {
  if (typeof localStorage === "undefined") return;

  // Clear localStorage immediately
  localStorage.removeItem(SIDEBAR_TOUR_COMPLETED_KEY);
  localStorage.removeItem(`${SIDEBAR_TOUR_COMPLETED_KEY}-at`);
  localStorage.removeItem(SIDEBAR_TOUR_SKIPPED_KEY);

  // Sync to Firebase via service (non-blocking)
  const service = getOnboardingService();
  if (service) {
    void service.resetSidebarTour();
  }
}

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
  // Always update localStorage immediately for synchronous access
  const key = getModuleOnboardingKey(moduleId);
  const timestampKey = getModuleOnboardingTimestampKey(moduleId);
  localStorage.setItem(key, "true");
  localStorage.setItem(timestampKey, new Date().toISOString());

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
  localStorage.removeItem(key);
  localStorage.removeItem(timestampKey);

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
  localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  localStorage.removeItem(ONBOARDING_COMPLETED_AT_KEY);
  localStorage.removeItem(ONBOARDING_SKIPPED_KEY);

  // Per-module
  Object.values(MODULE_ONBOARDING_KEYS).forEach((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(key.replace("-completed", "-completed-at"));
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
