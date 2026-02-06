// Temporary interface definitions
export interface IAppState {
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
