export interface AutoHideControllerOptions {
  /** Delay in ms before auto-hiding (default: 3000) */
  hideDelay?: number;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Condition that must be true for auto-hide to activate */
  shouldAutoHide?: () => boolean;
}
/**
 * Controls auto-hiding behavior for UI elements.
 * Used for fullscreen controls and footer auto-hide.
 */
export class AutoHideController {
  private _isVisible = true;
  private _hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly _hideDelay: number;
  private readonly _onVisibilityChange?: (visible: boolean) => void;
  private readonly _shouldAutoHide?: () => boolean;

  constructor(options: AutoHideControllerOptions = {}) {
    this._hideDelay = options.hideDelay ?? 3000;
    this._onVisibilityChange = options.onVisibilityChange;
    this._shouldAutoHide = options.shouldAutoHide;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  show(): void {
    this._isVisible = true;
    this._onVisibilityChange?.(true);
    this.scheduleHide();
  }

  hide(): void {
    this._isVisible = false;
    this._onVisibilityChange?.(false);
    this.cancelTimer();
  }

  cancelTimer(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
  }

  dispose(): void {
    this.cancelTimer();
  }

  private scheduleHide(): void {
    this.cancelTimer();

    // Check condition if provided
    if (this._shouldAutoHide && !this._shouldAutoHide()) {
      return;
    }

    this._hideTimeout = setTimeout(() => {
      this._isVisible = false;
      this._onVisibilityChange?.(false);
    }, this._hideDelay);
  }
}

/**
 * Factory function to create an auto-hide controller.
 * Use this instead of the singleton when you need multiple instances.
 */
export function createAutoHideController(options?: AutoHideControllerOptions): AutoHideController {
  return new AutoHideController(options);
}
