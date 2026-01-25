/**
 * Browse Display State
 *
 * Focused microservice for managing browse UI display state.
 * Handles loading, error, and display settings without business logic.
 */

import type {
  ExploreDisplayState,
  ExploreLoadingState,
} from "$lib/features/explore/shared/domain/models/explore-models";
import {
  createDefaultDisplayState,
  createDefaultLoadingState,
} from "$lib/features/explore/shared/domain/models/explore-models";

export interface IExploreDisplayStateService {
  // Reactive state getters
  readonly loadingState: ExploreLoadingState;
  readonly displayState: ExploreDisplayState;
  readonly isLoading: boolean;
  readonly hasError: boolean;

  // Loading actions
  setLoading(loading: boolean, operation?: string): void;
  setError(error: string | null): void;
  clearError(): void;

  // Display actions
  updateDisplaySettings(settings: Partial<ExploreDisplayState>): void;
  resetDisplayState(): void;
}

/**
 * Factory function to create gallery display state
 * Uses Svelte 5 runes for reactivity
 */
export function createGalleryDisplayStateService(): IExploreDisplayStateService {
  // Private reactive state using Svelte 5 runes
  const loadingState = $state<ExploreLoadingState>(createDefaultLoadingState());
  let displayState = $state<ExploreDisplayState>(createDefaultDisplayState());

  return {
    // Reactive getters
    get loadingState() {
      return loadingState;
    },

    get displayState() {
      return displayState;
    },

    get isLoading() {
      return loadingState.isLoading;
    },

    get hasError() {
      return (
        (loadingState as ExploreLoadingState & { error: string | null })
          .error !== null
      );
    },

    // Loading actions
    setLoading(loading: boolean, operation?: string): void {
      loadingState.isLoading = loading;
      if (operation) {
        (
          loadingState as ExploreLoadingState & { currentOperation: string }
        ).currentOperation = operation;
      }
      if (loading) {
        (loadingState as ExploreLoadingState & { error: string | null }).error =
          null; // Clear error when starting new operation
      }
    },

    setError(error: string | null): void {
      (loadingState as ExploreLoadingState & { error: string | null }).error =
        error;
      loadingState.isLoading = false; // Stop loading on error
    },

    clearError(): void {
      (loadingState as ExploreLoadingState & { error: string | null }).error =
        null;
    },

    // Display actions
    updateDisplaySettings(settings: Partial<ExploreDisplayState>): void {
      displayState = { ...displayState, ...settings };
    },

    resetDisplayState(): void {
      displayState = createDefaultDisplayState();
    },
  };
}

// For backward compatibility, export a class-like interface
export class ExploreDisplayStateService implements IExploreDisplayStateService {
  private state = createGalleryDisplayStateService();

  get loadingState() {
    return this.state.loadingState;
  }
  get displayState() {
    return this.state.displayState;
  }
  get isLoading() {
    return this.state.isLoading;
  }
  get hasError() {
    return this.state.hasError;
  }

  setLoading(loading: boolean, operation?: string): void {
    this.state.setLoading(loading, operation);
  }

  setError(error: string | null): void {
    this.state.setError(error);
  }

  clearError(): void {
    this.state.clearError();
  }

  updateDisplaySettings(settings: Partial<ExploreDisplayState>): void {
    this.state.updateDisplaySettings(settings);
  }

  resetDisplayState(): void {
    this.state.resetDisplayState();
  }
}
