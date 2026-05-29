import type { IAppStateInitializer } from "../../../application/state/app-state-contracts";

export function createAppStateInitializer(): IAppStateInitializer {
  let isInitialized = $state<boolean>(false);
  let isInitializing = $state<boolean>(false);
  let initializationError = $state<string | null>(null);
  let initializationProgress = $state<number>(0);

  return {
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

    get initializationComplete() {
      return initializationProgress >= 100;
    },

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
