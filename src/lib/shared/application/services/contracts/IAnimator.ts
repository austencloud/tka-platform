/**
 * Animation Service Types
 *
 * Co-exported types for the UI animation system.
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

