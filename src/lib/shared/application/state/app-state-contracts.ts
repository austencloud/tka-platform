/**
 * State Service Interfaces
 *
 * All interfaces for the refactored state management services.
 * Consolidated into a single file for simplicity since they're small.
 */

import type { TabId } from "../../navigation/domain/types";

// TODO: Import IBrowseStatePersister when it's properly exported
// import type { IBrowseStatePersister } from "../../../../features/browse/Browse/services/contracts";


/**
 * Core application state management (UI state, transitions, etc.)
 */
export interface IApplicationStateService {
  // State getters
  readonly isFullScreen: boolean;
  readonly isTransitioning: boolean;
  readonly showSettings: boolean;

  // Derived state
  readonly isReady: boolean;
  readonly canUseApp: boolean;

  // Actions
  setFullScreen(fullScreen: boolean): void;
  setTransitioning(isTransitioning: boolean): void;
  showSettingsDialog(): void;
  hideSettingsDialog(): void;
  toggleSettingsDialog(): void;

  // State management
  getStateSnapshot(): object;
  resetState(): void;
}

/**
 * Tab navigation and state persistence
 */
export interface IMainTabState {
  // State getters
  readonly activeTab: TabId;
  // readonly browseStatePersistence: IBrowseStatePersister; // TODO: Add when interface is exported

  // Actions
  switchTab(tab: TabId): Promise<void>;
  isTabActive(tab: string): boolean;

  // Persistence
  saveCurrentTabState(tab: TabId): Promise<void>;
  restoreApplicationState(): Promise<void>;
}

/**
 * Application initialization state
 */
export interface IAppStateInitializer {
  // State getters
  readonly isInitialized: boolean;
  readonly isInitializing: boolean;
  readonly initializationError: string | null;
  readonly initializationProgress: number;

  // Derived state
  readonly initializationComplete: boolean;

  // Actions
  setInitializationState(
    initialized: boolean,
    initializing: boolean,
    error?: string | null,
    progress?: number
  ): void;
  setInitializationError(error: string): void;
  setInitializationProgress(progress: number): void;
  resetInitializationState(): void;
}

/**
 * Performance metrics tracking
 */
