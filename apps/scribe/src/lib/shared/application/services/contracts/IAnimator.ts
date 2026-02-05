/**
 * Animation Service Contract
 *
 * Handles UI animations and transitions including fold transitions,
 * fade effects, and animation settings management.
 */

export interface FoldTransitionParams {
  duration?: number;
  direction?: "fold-in" | "fold-out";
  axis?: "x" | "y";
  easing?: (t: number) => number;
}

export interface SlideTransitionParams {
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  delay?: number;
}

export interface FadeTransitionParams {
  duration?: number;
  delay?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AnimationSettings {
  // Animations are always enabled, this interface kept for compatibility
}

export interface TransitionResult {
  duration: number;
  delay?: number;
  easing?: (t: number) => number;
  css?: (t: number) => string;
}

export interface IAnimator {
  /**
   * Create a fold transition effect
   */
  createFoldTransition(params?: FoldTransitionParams): TransitionResult;

  /**
   * Create a slide transition effect
   */
  createSlideTransition(params?: SlideTransitionParams): TransitionResult;

  /**
   * Create a basic fade transition
   */
  createFadeTransition(params?: FadeTransitionParams): TransitionResult;

  /**
   * Create a fade out transition
   */
  createFadeOutTransition(
    params?: FadeTransitionParams & { settings?: AnimationSettings }
  ): TransitionResult;

  /**
   * Create a fade in transition with delay
   */
  createFadeInTransition(
    params?: FadeTransitionParams & {
      outDuration?: number;
      settings?: AnimationSettings;
    }
  ): TransitionResult;

  /**
   * Create a conditional fade that respects settings
   */
  createConditionalFade(
    params?: FadeTransitionParams & { settings?: AnimationSettings }
  ): TransitionResult;

  /**
   * Check if animations should be enabled based on user preferences
   */
  shouldAnimate(settings?: AnimationSettings): boolean;
}
