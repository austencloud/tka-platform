import {
  areServicesInitialized,
  initializeAppServices,
} from "./services.svelte";

const initializationState = $state({
  isInitialized: areServicesInitialized(),
  isInitializing: false,
  initializationError: null as string | null,
  initializationProgress: areServicesInitialized() ? 100 : 0,
});

export async function initializeAppState(): Promise<void> {
  if (initializationState.isInitialized) return;

  try {
    setInitializationState(
      false,
      true,
      null,
      initializationState.initializationProgress
    );
    await initializeAppServices();
    setInitializationState(true, false, null, 100);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize app state";
    setInitializationState(false, false, message, 0);
    throw error;
  }
}

export function getIsInitialized() {
  return initializationState.isInitialized;
}

export function getIsInitializing() {
  return initializationState.isInitializing;
}

export function getInitializationError() {
  return initializationState.initializationError;
}

export function getInitializationProgress() {
  return initializationState.initializationProgress;
}

export function getInitializationComplete() {
  return (
    initializationState.isInitialized && !initializationState.isInitializing
  );
}

export function setInitializationState(
  initialized: boolean,
  initializing: boolean,
  error: string | null = null,
  progress: number = 0
): void {
  initializationState.isInitialized = initialized;
  initializationState.isInitializing = initializing;
  initializationState.initializationError = error;
  initializationState.initializationProgress = progress;
}

export function setInitializationError(error: string): void {
  initializationState.initializationError = error;
}

export function setInitializationProgress(progress: number): void {
  initializationState.initializationProgress = progress;
}

export function resetInitializationState(): void {
  initializationState.isInitialized = areServicesInitialized();
  initializationState.isInitializing = false;
  initializationState.initializationError = null;
  initializationState.initializationProgress = areServicesInitialized()
    ? 100
    : 0;
}
