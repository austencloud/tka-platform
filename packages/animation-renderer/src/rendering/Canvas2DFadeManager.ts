/**
 * Canvas2D Fade Transition Manager
 *
 * Handles glyph fade transitions:
 * - Fade-in/fade-out timing
 * - Alpha interpolation
 * - Transition state management
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

  startFadeTransition(): void {
    this.isFading = true;
    this.fadeProgress = 0;
    this.fadeStartTime = performance.now();
  }

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

  isFadingInProgress(): boolean {
    return this.isFading;
  }

  getFadeProgress(): number {
    return this.fadeProgress;
  }

  reset(): void {
    this.isFading = false;
    this.fadeProgress = 0;
    this.fadeStartTime = null;
  }
}
