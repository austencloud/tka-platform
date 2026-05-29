/**
 * Canvas2D Fade Transition Manager
 *
 * Handles glyph fade transitions:
 * - Fade-in/fade-out timing
 * - Alpha interpolation
 * - Transition state management
 *
 * Single Responsibility: Glyph fade transition logic
 */

export interface FadeState {
  currentAlpha: number;
  previousAlpha: number;
  isComplete: boolean;
}

export class Canvas2DFadeManager {
  private readonly FADE_DURATION_MS = 300;

  private isFading: boolean = false;
  private fadeProgress: number = 0;
  private fadeStartTime: number | null = null;

  /**
   * Start a new fade transition
   */
  startFadeTransition(): void {
    this.isFading = true;
    this.fadeProgress = 0;
    this.fadeStartTime = performance.now();
  }

  /**
   * Update fade progress and return alpha values for rendering
   */
  updateFadeProgress(currentTime: number): FadeState {
    if (!this.isFading || this.fadeStartTime === null) {
      return {
        currentAlpha: 1,
        previousAlpha: 0,
        isComplete: true,
      };
    }

    const elapsed = currentTime - this.fadeStartTime;
    this.fadeProgress = Math.min(elapsed / this.FADE_DURATION_MS, 1);

    const currentAlpha = this.fadeProgress;
    const previousAlpha = 1 - this.fadeProgress;

    // Check if fade complete
    if (this.fadeProgress >= 1) {
      this.isFading = false;
      this.fadeProgress = 1;
      return {
        currentAlpha: 1,
        previousAlpha: 0,
        isComplete: true,
      };
    }

    return {
      currentAlpha,
      previousAlpha,
      isComplete: false,
    };
  }

  /**
   * Check if currently fading
   */
  isFadingInProgress(): boolean {
    return this.isFading;
  }

  /**
   * Get current fade progress (0-1)
   */
  getFadeProgress(): number {
    return this.fadeProgress;
  }

  /**
   * Reset transition state
   */
  reset(): void {
    this.isFading = false;
    this.fadeProgress = 0;
    this.fadeStartTime = null;
  }
}
