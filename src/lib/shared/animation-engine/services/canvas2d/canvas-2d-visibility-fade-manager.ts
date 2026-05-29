/**
 * Canvas2D Visibility Fade Manager
 *
 * Generic fade transition manager for canvas elements.
 * Used for props, trails, and other toggleable elements.
 *
 * Single Responsibility: Visibility transition logic with smooth fading
 */

export interface VisibilityFadeState {
  alpha: number;
  isTransitioning: boolean;
  targetVisible: boolean;
}

export class Canvas2DVisibilityFadeManager {
  private readonly fadeInDurationMs: number;
  private readonly fadeOutDurationMs: number;

  private isTransitioning: boolean = false;
  private transitionStartTime: number | null = null;
  private currentAlpha: number = 1;
  private targetVisible: boolean = true;
  private previousVisible: boolean = true;

  constructor(fadeInMs: number = 250, fadeOutMs: number = 200) {
    this.fadeInDurationMs = fadeInMs;
    this.fadeOutDurationMs = fadeOutMs;
  }

  /**
   * Update visibility state and trigger transition if needed
   */
  setVisible(visible: boolean): void {
    if (visible !== this.previousVisible) {
      this.targetVisible = visible;
      this.isTransitioning = true;
      this.transitionStartTime = performance.now();
      this.previousVisible = visible;
    }
  }

  /**
   * Update transition progress and return current alpha
   */
  updateProgress(currentTime: number): VisibilityFadeState {
    if (!this.isTransitioning || this.transitionStartTime === null) {
      this.currentAlpha = this.targetVisible ? 1 : 0;
      return {
        alpha: this.currentAlpha,
        isTransitioning: false,
        targetVisible: this.targetVisible,
      };
    }

    const elapsed = currentTime - this.transitionStartTime;
    const duration = this.targetVisible
      ? this.fadeInDurationMs
      : this.fadeOutDurationMs;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth cubic easing for both directions
    if (this.targetVisible) {
      this.currentAlpha = this.easeOutCubic(progress);
    } else {
      this.currentAlpha = 1 - this.easeOutCubic(progress);
    }

    // Clamp alpha to valid range
    this.currentAlpha = Math.max(0, Math.min(1, this.currentAlpha));

    // Check if transition complete
    if (progress >= 1) {
      this.isTransitioning = false;
      this.currentAlpha = this.targetVisible ? 1 : 0;
      return {
        alpha: this.currentAlpha,
        isTransitioning: false,
        targetVisible: this.targetVisible,
      };
    }

    return {
      alpha: this.currentAlpha,
      isTransitioning: true,
      targetVisible: this.targetVisible,
    };
  }

  /**
   * Cubic ease-out for smooth fade
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Check if currently transitioning
   */
  isTransitionInProgress(): boolean {
    return this.isTransitioning;
  }

  /**
   * Get current alpha value
   */
  getAlpha(): number {
    return this.currentAlpha;
  }

  /**
   * Reset to visible state
   */
  reset(): void {
    this.isTransitioning = false;
    this.transitionStartTime = null;
    this.currentAlpha = 1;
    this.targetVisible = true;
    this.previousVisible = true;
  }
}
