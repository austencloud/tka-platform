/**
 * Initialization Service Factory
 *
 * Manages application initialization state and progress.
 * Clean separation of initialization logic from other concerns.
 */

import type { IAppStateInitializer } from "../../../../application/state/app-state-contracts";

/**
 * Factory function to create app state initializer
 * Uses Svelte 5 runes for reactivity
 */
export function createAppStateInitializer(): IAppStateInitializer {
  // Initialization state using Svelte 5 runes
  let isInitialized = $state<boolean>(false);
  let isInitializing = $state<boolean>(false);
  let initializationError = $state<string | null>(null);
  let initializationProgress = $state<number>(0);

  return {
    // ============================================================================
    // GETTERS
    // ============================================================================

    get isInitialized() {
      return isInitialized;
    },

    get isInitializing() {
      return isInitializing;
    },

    get initializationError() {
      return initializationError;
    },

    get initializationProgress() {
      return initializationProgress;
    },

    // Derived state
    get initializationComplete() {
      return initializationProgress >= 100;
    },

    // ============================================================================
    // ACTIONS
    // ============================================================================

    setInitializationState(
      initialized: boolean,
      initializing: boolean,
      error: string | null = null,
      progress: number = 0
    ): void {
      isInitialized = initialized;
      isInitializing = initializing;
      initializationError = error;
      initializationProgress = progress;
    },

    setInitializationError(error: string): void {
      initializationError = error;
      isInitialized = false;
      isInitializing = false;
    },

    setInitializationProgress(progress: number): void {
      initializationProgress = progress;
    },

    resetInitializationState(): void {
      isInitialized = false;
      isInitializing = false;
      initializationError = null;
      initializationProgress = 0;
    },
  };
}

// Export the factory function for DI container binding
// Singleton instance will be managed by the DI container
