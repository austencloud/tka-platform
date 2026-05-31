/**
 * OnboardingPersister
 *
 * Persists onboarding completion status to Firebase for authenticated users.
 * Falls back to localStorage for anonymous users.
 * Syncs local progress to cloud on authentication.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import type { OnboardingStatus } from "./types";
import {
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_COMPLETED_AT_KEY,
  ONBOARDING_SKIPPED_KEY,
  getModuleOnboardingKey,
  getModuleOnboardingTimestampKey,
} from "../config/storage-keys";

const LAST_SEEN_VERSION_KEY = "tka-last-seen-version";

const MODULES_WITH_ONBOARDING = [
  "browse",
  "learn",
  "create",
  "compose",
  "train",
  "library",
];

export class OnboardingPersister {
  private cachedStatus: OnboardingStatus | null = null;
  private unsubscribe: Unsubscribe | null = null;

  /**
   * Get the Firestore document reference for onboarding status
   * NOTE: Uses the actual authenticated user's ID (not effectiveUserId)
   * because onboarding status should always be for the current user,
   * not a previewed user during admin preview mode.
   */
  private async getOnboardingDocRef() {
    // Use the actual user ID, not effectiveUserId, to avoid permission errors
    // when admin is in preview mode viewing another user's data
    const userId = authState.user?.uid;
    if (!userId) {
      return null;
    }
    const firestore = await getFirestoreInstance();
    return doc(firestore, `users/${userId}/onboarding/status`);
  }

  /**
   * Create default empty onboarding status
   */
  private createDefaultStatus(): OnboardingStatus {
    const modules: OnboardingStatus["modules"] = {};
    for (const moduleId of MODULES_WITH_ONBOARDING) {
      modules[moduleId] = { completed: false, completedAt: null };
    }
    return {
      appCompleted: false,
      appSkipped: false,
      appCompletedAt: null,
      modules,
      lastSeenVersion: null,
    };
  }

  /**
   * Load status from localStorage (for anonymous users or as fallback)
   */
  private loadFromLocalStorage(): OnboardingStatus {
    if (typeof localStorage === "undefined") {
      return this.createDefaultStatus();
    }

    const appCompleted =
      localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
    const appSkipped = localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "true";
    const appCompletedAt =
      localStorage.getItem(ONBOARDING_COMPLETED_AT_KEY) || null;

    const modules: OnboardingStatus["modules"] = {};
    for (const moduleId of MODULES_WITH_ONBOARDING) {
      const key = getModuleOnboardingKey(moduleId);
      const timestampKey = getModuleOnboardingTimestampKey(moduleId);
      modules[moduleId] = {
        completed: localStorage.getItem(key) === "true",
        completedAt: localStorage.getItem(timestampKey) || null,
      };
    }

    // Last seen version
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY) || null;

    return {
      appCompleted,
      appSkipped,
      appCompletedAt,
      modules,
      lastSeenVersion,
    };
  }

  /**
   * Save status to localStorage
   */
  private saveToLocalStorage(status: OnboardingStatus): void {
    if (typeof localStorage === "undefined") return;

    // App-wide
    if (status.appCompleted) {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    } else {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    }

    if (status.appSkipped) {
      localStorage.setItem(ONBOARDING_SKIPPED_KEY, "true");
    } else {
      localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
    }

    if (status.appCompletedAt) {
      localStorage.setItem(ONBOARDING_COMPLETED_AT_KEY, status.appCompletedAt);
    } else {
      localStorage.removeItem(ONBOARDING_COMPLETED_AT_KEY);
    }

    // Per-module
    for (const [moduleId, moduleStatus] of Object.entries(status.modules)) {
      const key = getModuleOnboardingKey(moduleId);
      const timestampKey = getModuleOnboardingTimestampKey(moduleId);

      if (moduleStatus.completed) {
        localStorage.setItem(key, "true");
      } else {
        localStorage.removeItem(key);
      }

      if (moduleStatus.completedAt) {
        localStorage.setItem(timestampKey, moduleStatus.completedAt);
      } else {
        localStorage.removeItem(timestampKey);
      }
    }

    // Last seen version
    if (status.lastSeenVersion) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, status.lastSeenVersion);
    } else {
      localStorage.removeItem(LAST_SEEN_VERSION_KEY);
    }
  }

  /**
   * Load onboarding status from Firebase or localStorage
   */
  async loadStatus(): Promise<OnboardingStatus> {
    const docRef = await this.getOnboardingDocRef();

    // Not authenticated - use localStorage
    if (!docRef) {
      this.cachedStatus = this.loadFromLocalStorage();
      return this.cachedStatus;
    }

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as OnboardingStatus;
        // Ensure all fields are present with defaults
        const status = this.createDefaultStatus();
        status.appCompleted = data.appCompleted ?? false;
        status.appSkipped = data.appSkipped ?? false;
        status.appCompletedAt = data.appCompletedAt ?? null;
        if (data.modules) {
          for (const [moduleId, moduleStatus] of Object.entries(data.modules)) {
            if (status.modules[moduleId]) {
              status.modules[moduleId] = moduleStatus;
            }
          }
        }
        // Last seen version
        status.lastSeenVersion = data.lastSeenVersion ?? null;

        this.cachedStatus = status;
        // Also sync to localStorage for fast access
        this.saveToLocalStorage(status);
        return status;
      }

      // No cloud data - use localStorage and sync to cloud
      this.cachedStatus = this.loadFromLocalStorage();
      await this.saveStatus(this.cachedStatus);
      return this.cachedStatus;
    } catch (error) {
      console.error(
        "❌ [OnboardingPersister] Failed to load from Firebase:",
        error
      );
      // Fall back to localStorage
      this.cachedStatus = this.loadFromLocalStorage();
      return this.cachedStatus;
    }
  }

  /**
   * Save onboarding status to Firebase and localStorage
   */
  async saveStatus(status: OnboardingStatus): Promise<void> {
    // Always save to localStorage for fast access
    this.saveToLocalStorage(status);
    this.cachedStatus = status;

    const docRef = await this.getOnboardingDocRef();
    if (!docRef) {
      // Not authenticated - localStorage only
      return;
    }

    try {
      await setDoc(
        docRef,
        {
          ...status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        "❌ [OnboardingPersister] Failed to save to Firebase:",
        error
      );
      // Don't throw - localStorage is still updated
    }
  }

  /**
   * Check if a module's onboarding is completed (synchronous, uses cache/localStorage)
   */
  hasCompletedModule(moduleId: string): boolean {
    // Check cache first
    if (this.cachedStatus) {
      return this.cachedStatus.modules[moduleId]?.completed ?? false;
    }

    // Fall back to localStorage for immediate check
    if (typeof localStorage === "undefined") return false;
    const key = getModuleOnboardingKey(moduleId);
    return localStorage.getItem(key) === "true";
  }

  /**
   * Mark a module's onboarding as completed
   */
  async markModuleCompleted(moduleId: string): Promise<void> {
    const status = this.cachedStatus || (await this.loadStatus());
    const now = new Date().toISOString();

    if (!status.modules[moduleId]) {
      status.modules[moduleId] = { completed: false, completedAt: null };
    }
    status.modules[moduleId].completed = true;
    status.modules[moduleId].completedAt = now;

    await this.saveStatus(status);
  }

  /**
   * Reset a module's onboarding status
   */
  async resetModule(moduleId: string): Promise<void> {
    const status = this.cachedStatus || (await this.loadStatus());

    if (status.modules[moduleId]) {
      status.modules[moduleId].completed = false;
      status.modules[moduleId].completedAt = null;
    }

    await this.saveStatus(status);
  }

  /**
   * Check if app-wide onboarding is completed
   */
  hasCompletedApp(): boolean {
    if (this.cachedStatus) {
      return this.cachedStatus.appCompleted || this.cachedStatus.appSkipped;
    }

    if (typeof localStorage === "undefined") return false;
    return (
      localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true" ||
      localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "true"
    );
  }

  /**
   * Mark app-wide onboarding as completed
   */
  async markAppCompleted(): Promise<void> {
    const status = this.cachedStatus || (await this.loadStatus());
    status.appCompleted = true;
    status.appCompletedAt = new Date().toISOString();
    await this.saveStatus(status);
  }

  /**
   * Mark app-wide onboarding as skipped
   */
  async markAppSkipped(): Promise<void> {
    const status = this.cachedStatus || (await this.loadStatus());
    status.appSkipped = true;
    await this.saveStatus(status);
  }

  /**
   * Reset all onboarding status
   */
  async resetAll(): Promise<void> {
    const status = this.createDefaultStatus();
    await this.saveStatus(status);
  }

  /**
   * Subscribe to real-time updates
   */
  async subscribe(
    callback: (status: OnboardingStatus) => void
  ): Promise<() => void> {
    const docRef = await this.getOnboardingDocRef();
    if (!docRef) {
      // Not authenticated - just return current status
      callback(this.cachedStatus || this.loadFromLocalStorage());
      return () => {};
    }

    this.unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as OnboardingStatus;
          const status = this.createDefaultStatus();
          status.appCompleted = data.appCompleted ?? false;
          status.appSkipped = data.appSkipped ?? false;
          status.appCompletedAt = data.appCompletedAt ?? null;
          if (data.modules) {
            for (const [moduleId, moduleStatus] of Object.entries(
              data.modules
            )) {
              if (status.modules[moduleId]) {
                status.modules[moduleId] = moduleStatus;
              }
            }
          }
          // Last seen version
          status.lastSeenVersion = data.lastSeenVersion ?? null;

          this.cachedStatus = status;
          this.saveToLocalStorage(status);
          callback(status);
        }
      },
      (error) => {
        console.error("❌ [OnboardingPersister] Subscription error:", error);
      }
    );

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  /**
   * Sync localStorage to Firebase when user authenticates
   */
  async syncLocalToCloud(): Promise<void> {
    const docRef = await this.getOnboardingDocRef();
    if (!docRef) return;

    const localStatus = this.loadFromLocalStorage();

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        // Merge: keep most complete state
        const cloudStatus = docSnap.data() as OnboardingStatus;
        const mergedStatus = this.createDefaultStatus();

        // App-wide: prefer completed/skipped
        mergedStatus.appCompleted =
          localStatus.appCompleted || cloudStatus.appCompleted;
        mergedStatus.appSkipped =
          localStatus.appSkipped || cloudStatus.appSkipped;
        mergedStatus.appCompletedAt =
          localStatus.appCompletedAt || cloudStatus.appCompletedAt || null;

        // Per-module: prefer completed
        for (const moduleId of MODULES_WITH_ONBOARDING) {
          const local = localStatus.modules[moduleId];
          const cloud = cloudStatus.modules?.[moduleId];

          mergedStatus.modules[moduleId] = {
            completed: local?.completed || cloud?.completed || false,
            completedAt: local?.completedAt || cloud?.completedAt || null,
          };
        }

        // Last seen version: prefer the newer version (lexicographically higher)
        const localVersion = localStatus.lastSeenVersion;
        const cloudVersion = cloudStatus.lastSeenVersion;
        if (localVersion && cloudVersion) {
          // Compare versions - keep the higher one
          mergedStatus.lastSeenVersion =
            localVersion > cloudVersion ? localVersion : cloudVersion;
        } else {
          mergedStatus.lastSeenVersion = localVersion || cloudVersion || null;
        }

        await this.saveStatus(mergedStatus);
      } else {
        // No cloud data - push local to cloud
        await this.saveStatus(localStatus);
      }
    } catch (error) {
      console.error("❌ [OnboardingPersister] Failed to sync:", error);
    }
  }

  // ===========================================================================
  // What's New Version Tracking Methods
  // ===========================================================================

  /**
   * Check if user has seen the given version in What's New.
   */
  hasSeenVersion(version: string): boolean {
    if (this.cachedStatus) {
      return this.cachedStatus.lastSeenVersion === version;
    }

    // Fall back to localStorage for synchronous access
    if (typeof localStorage === "undefined") return true;
    const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    return lastSeen === version;
  }

  /**
   * Mark a version as seen in What's New.
   */
  async markVersionAsSeen(version: string): Promise<void> {
    const status = this.cachedStatus || (await this.loadStatus());
    status.lastSeenVersion = version;
    await this.saveStatus(status);
  }

  /**
   * Get the last seen version (for debugging/display).
   */
  getLastSeenVersion(): string | null {
    if (this.cachedStatus) {
      return this.cachedStatus.lastSeenVersion;
    }

    // Fall back to localStorage
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LAST_SEEN_VERSION_KEY);
  }
}
