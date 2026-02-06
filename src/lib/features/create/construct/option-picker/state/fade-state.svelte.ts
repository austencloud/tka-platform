/**
 * Fade State - Controls fade in/out transitions for option picker
 *
 * Single responsibility: Manage fade timing and state.
 * Used by OptionPicker to coordinate visual transitions when options change.
 */

const FADE_OUT_DURATION = 250;
const FADE_IN_DURATION = 250;

export interface FadeState {
  /** Whether content is currently fading out (opacity 0) */
  readonly isFading: boolean;
  /** Duration constants for CSS transitions */
  readonly fadeOutDuration: number;
  readonly fadeInDuration: number;
  /** Start fade-out, returns promise that resolves when fade completes */
  fadeOut: () => Promise<void>;
  /** End fade (set opacity back to 1) */
  fadeIn: () => void;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Creates a fade state controller
 */
export function createFadeState(): FadeState {
  let isFading = $state(false);

  return {
    get isFading() {
      return isFading;
    },
    fadeOutDuration: FADE_OUT_DURATION,
    fadeInDuration: FADE_IN_DURATION,

    async fadeOut() {
      isFading = true;
      // Wait for CSS transition to complete
      await new Promise((resolve) => setTimeout(resolve, FADE_OUT_DURATION));
    },

    fadeIn() {
      isFading = false;
    },

    reset() {
      isFading = false;
    },
  };
}
