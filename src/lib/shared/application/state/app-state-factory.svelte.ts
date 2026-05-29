/**
 * Application State Factory
 *
 * Manages core UI state like full screen, transitions, and settings dialog visibility.
 * Clean and focused on UI state only.
 */

interface AppState {
  isFullScreen: boolean;
  isTransitioning: boolean;
  showSettings: boolean;
  isReady: boolean;
  canUseApp: boolean;

  // Actions
  setFullScreen(fullScreen: boolean): void;
  toggleFullScreen(): void;
  setTransitioning(isTransitioningValue: boolean): void;
  showSettingsDialog(): void;
  hideSettingsDialog(): void;
  toggleSettingsDialog(): void;

  // State management
  getStateSnapshot(): object;
  resetState(): void;
}

/**
 * Factory function to create application state
 * Uses Svelte 5 runes for reactivity
 */
export function createAppState(): AppState {
  // Core UI state using Svelte 5 runes
  let isFullScreen = $state<boolean>(false);
  let isTransitioning = $state<boolean>(false);
  let showSettings = $state<boolean>(false);

  return {
    // ============================================================================
    // GETTERS (Reactive)
    // ============================================================================

    get isFullScreen() {
      return isFullScreen;
    },

    get isTransitioning() {
      return isTransitioning;
    },

    get showSettings() {
      return showSettings;
    },

    // Derived state
    get isReady() {
      // Will be connected to initialization service later
      return true; // Placeholder
    },

    get canUseApp() {
      return !showSettings; // isReady check removed since app is always ready
    },

    // ============================================================================
    // ACTIONS
    // ============================================================================

    setFullScreen(fullScreen: boolean): void {
      isFullScreen = fullScreen;
    },

    toggleFullScreen(): void {
      isFullScreen = !isFullScreen;
    },

    setTransitioning(isTransitioningValue: boolean): void {
      isTransitioning = isTransitioningValue;
    },

    showSettingsDialog(): void {
      showSettings = true;
    },

    hideSettingsDialog(): void {
      showSettings = false;
    },

    toggleSettingsDialog(): void {
      showSettings = !showSettings;
    },

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    getStateSnapshot(): object {
      return {
        isFullScreen,
        isTransitioning,
        showSettings,
      };
    },

    resetState(): void {
      isFullScreen = false;
      isTransitioning = false;
      showSettings = false;
    },
  };
}

// Export the factory function for DI container binding
// Singleton instance will be managed by the DI container
