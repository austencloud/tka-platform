/**
 * Global Feature Flag Persister Interface
 *
 * Persists admin-set global feature flag overrides to Firestore
 * so they apply across all users and devices, not just the admin's browser.
 */

import type { UserRole } from "../../domain/models/UserRole";

export interface GlobalFlagOverrides {
  globalFlagOverrides: Record<string, boolean>;
  globalRoleOverrides: Record<string, UserRole>;
}

export interface IGlobalFeatureFlagPersister {
  /**
   * Load global flag overrides from Firestore.
   * Falls back to localStorage if Firestore is unavailable.
   */
  load(): Promise<GlobalFlagOverrides>;

  /**
   * Save global flag overrides to Firestore with audit metadata.
   * Also writes through to localStorage for offline resilience.
   */
  save(overrides: GlobalFlagOverrides): Promise<void>;

  /**
   * Subscribe to real-time changes from Firestore.
   * Calls back whenever another admin (or this admin on another device) updates overrides.
   */
  subscribe(callback: (overrides: GlobalFlagOverrides) => void): void;

  /**
   * Clean up Firestore listener.
   */
  dispose(): void;
}
