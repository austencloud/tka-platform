/**
 * Controls auto-hiding behavior for UI elements (fullscreen controls, footer).
 */
export interface IAutoHideController {
  /** Whether the controlled element is currently visible */
  readonly isVisible: boolean;

  /** Show the element and start auto-hide timer */
  show(): void;
  /** Hide the element immediately */
  hide(): void;
  /** Cancel any pending auto-hide timer */
  cancelTimer(): void;
  /** Dispose and cleanup */
  dispose(): void;
}

export interface AutoHideControllerOptions {
  /** Delay in ms before auto-hiding (default: 3000) */
  hideDelay?: number;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Condition that must be true for auto-hide to activate */
  shouldAutoHide?: () => boolean;
}
