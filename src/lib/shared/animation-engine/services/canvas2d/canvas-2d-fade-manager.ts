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
  // Default (300ms) preserves the original glyph behavior. Other dual-source
  // fades may pass a project timing token when their visual weight differs.
  private readonly fadeDurationMs: number;

  private isFading: boolean = false;
  private fadeProgress: number = 0;
  private fadeStartTime: number | null = null;

  constructor(fadeDurationMs: number = 300) {
    this.fadeDurationMs = fadeDurationMs;
  }

  startFadeTransition(): void {
    this.isFading = true;
    this.fadeProgress = 0;
    // Stamp the start lazily on the next updateFadeProgress, using the SAME clock
    // the caller drives us with. The live path drives rAF performance.now(); the
    // offscreen video-export path drives a virtual clock that starts at 0.
    // Stamping performance.now() here and subtracting the virtual clock in
    // updateFadeProgress yielded a negative elapsed in export, so the glyph
    // cross-fade never advanced (new glyph pinned invisible, old glyph stuck).
    // Same bug class as the visibility/grid fade managers. Defer to the caller's clock.
    this.fadeStartTime = null;
  }

  /**
   * Update fade progress and return alpha values for rendering
   */
  updateFadeProgress(currentTime: number): FadeState {
    if (!this.isFading) {
      return {
        currentAlpha: 1,
        previousAlpha: 0,
        isComplete: true,
      };
    }

    // Lazily stamp the transition start with the caller's clock (see
    // startFadeTransition), so the start and the elapsed share one time source.
    if (this.fadeStartTime === null) {
      this.fadeStartTime = currentTime;
    }

    const elapsed = currentTime - this.fadeStartTime;
    this.fadeProgress = Math.min(elapsed / this.fadeDurationMs, 1);

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
