/**
 * Sequence Source State
 *
 * Manages the source toggle between Community (public) and My Library (user's sequences).
 * Uses Svelte 5 runes pattern for reactive state.
 * Persists selection to localStorage for cross-session memory.
 */

import { authState } from "$lib/shared/auth/state/authState.svelte";

export type SequenceSource = "community" | "my-library";

const STORAGE_KEY = "tka-sequence-source";
const OLD_STORAGE_KEY = "tka-gallery-source"; // For migration

/**
 * Migrate from old localStorage key if present
 */
function migrateFromOldKey(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const oldValue = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldValue) {
      localStorage.setItem(STORAGE_KEY, oldValue);
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// Run migration on module load
migrateFromOldKey();

class SequenceSourceManager {
  // Current source selection (restored from localStorage)
  source = $state<SequenceSource>(this.loadPersistedSource());

  // Callback for when source changes
  private onChangeCallbacks: Array<(source: SequenceSource) => void> = [];

  /**
   * Load persisted source from localStorage
   */
  private loadPersistedSource(): SequenceSource {
    if (typeof localStorage === "undefined") return "community";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "my-library" || stored === "community") {
        return stored;
      }
    } catch {
      // Ignore storage errors
    }
    return "community";
  }

  /**
   * Persist source to localStorage
   */
  private persistSource(source: SequenceSource): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, source);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get the current source
   */
  get current(): SequenceSource {
    return this.source;
  }

  /**
   * Check if My Library is selected
   */
  get isMyLibrary(): boolean {
    return this.source === "my-library";
  }

  /**
   * Check if Community is selected
   */
  get isCommunity(): boolean {
    return this.source === "community";
  }

  /**
   * Check if user can view their library (must be authenticated)
   */
  get canViewMyLibrary(): boolean {
    return authState.isAuthenticated;
  }

  /**
   * Set the source
   */
  setSource(newSource: SequenceSource): void {
    // If trying to set "my-library" but not authenticated, stay on community
    if (newSource === "my-library" && !authState.isAuthenticated) {
      return;
    }

    if (this.source !== newSource) {
      this.source = newSource;
      this.persistSource(newSource);
      // Notify listeners
      this.onChangeCallbacks.forEach((callback) => callback(newSource));
    }
  }

  /**
   * Toggle between sources
   */
  toggle(): void {
    if (this.source === "community" && authState.isAuthenticated) {
      this.setSource("my-library");
    } else {
      this.setSource("community");
    }
  }

  /**
   * Register a callback for source changes
   * Returns an unsubscribe function
   */
  onChange(callback: (source: SequenceSource) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Reset to community (default)
   */
  reset(): void {
    this.source = "community";
  }
}

export const sequenceSourceManager = new SequenceSourceManager();
