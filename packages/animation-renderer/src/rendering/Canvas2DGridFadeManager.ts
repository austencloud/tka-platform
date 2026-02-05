/**
 * Canvas2D Grid Fade Transition Manager
 *
 * Handles grid visibility toggle transitions:
 * - Smooth fade-in when grid becomes visible
 * - Smooth fade-out when grid becomes hidden
 * - Uses cubic easing for smooth transitions
 */

export interface GridFadeState {
  alpha: number;
  isTransitioning: boolean;
  targetVisible: boolean;
}

export class Canvas2DGridFadeManager {
  private readonly FADE_IN_DURATION_MS = 250;
  private readonly FADE_OUT_DURATION_MS = 200;

  private isTransitioning: boolean = false;
  private transitionStartTime: number | null = null;
  private currentAlpha: number = 1;
  private targetVisible: boolean = true;
  private previousVisible: boolean = true;

  setVisible(visible: boolean): void {
    if (visible !== this.previousVisible) {
      this.targetVisible = visible;
      this.isTransitioning = true;
      this.transitionStartTime = performance.now();
      this.previousVisible = visible;
    }
  }

  updateProgress(currentTime: number): GridFadeState {
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
      ? this.FADE_IN_DURATION_MS
      : this.FADE_OUT_DURATION_MS;
    const progress = Math.min(elapsed / duration, 1);

    if (this.targetVisible) {
      this.currentAlpha = this.easeOutCubic(progress);
    } else {
      this.currentAlpha = 1 - this.easeOutCubic(progress);
    }

    this.currentAlpha = Math.max(0, Math.min(1, this.currentAlpha));

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

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  isTransitionInProgress(): boolean {
    return this.isTransitioning;
  }

  getAlpha(): number {
    return this.currentAlpha;
  }

  reset(): void {
    this.isTransitioning = false;
    this.transitionStartTime = null;
    this.currentAlpha = 1;
    this.targetVisible = true;
    this.previousVisible = true;
  }
}
