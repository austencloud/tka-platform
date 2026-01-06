/**
 * 2026 Unified Transitions System
 *
 * Consistent, physics-based Svelte transitions for use across the app.
 * All durations and easings align with the CSS design tokens in app.css.
 */

import { cubicOut, quintOut, backOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

// ============================================================================
// DURATION CONSTANTS (match app.css tokens)
// ============================================================================

export const DURATION = {
  instant: 100, // Micro-feedback (hover states, toggles)
  fast: 150, // Quick UI responses (buttons, inputs)
  normal: 200, // Standard transitions (panels, tabs)
  emphasis: 280, // Emphasized changes (module switches)
  dramatic: 350, // Major transitions (drawers, modals)
} as const;

// ============================================================================
// STAGGER CONSTANTS (match app.css tokens)
// ============================================================================

export const STAGGER = {
  micro: 30, // Tight sequences (list items)
  normal: 50, // Standard sequences (cards)
  relaxed: 80, // Spread out (major sections)
} as const;

// ============================================================================
// TRANSFORM CONSTANTS (match app.css tokens)
// ============================================================================

export const SLIDE_DISTANCE = {
  sm: 8, // Subtle slides (tabs)
  md: 12, // Standard slides (cards, panels)
  lg: 20, // Prominent slides (modals)
} as const;

// ============================================================================
// CUSTOM EASING FUNCTIONS
// These match the CSS cubic-bezier curves in app.css
// ============================================================================

/** Material Design ease-out: cubic-bezier(0.16, 1, 0.3, 1) */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Spring easing with overshoot: cubic-bezier(0.34, 1.56, 0.64, 1) */
export function easeSpring(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// ============================================================================
// FADE TRANSITIONS
// ============================================================================

export interface FadeParams {
  delay?: number;
  duration?: number;
}

/** Standard fade - for simple visibility changes */
export function fadeStandard(
  _node: Element,
  { delay = 0, duration = DURATION.fast }: FadeParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    css: (t) => `opacity: ${t}`,
  };
}

/** Emphasized fade - slightly slower for important content */
export function fadeEmphasis(
  _node: Element,
  { delay = 0, duration = DURATION.normal }: FadeParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing: cubicOut,
    css: (t) => `opacity: ${t}`,
  };
}

// ============================================================================
// FLY TRANSITIONS
// ============================================================================

export interface FlyParams {
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  easing?: (t: number) => number;
}

/** Fly up - content enters from below */
export function flyUp(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    y = SLIDE_DISTANCE.md,
    easing = cubicOut,
  }: FlyParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateY = (1 - t) * y;
      return `
        opacity: ${t};
        transform: translateY(${translateY}px);
      `;
    },
  };
}

/** Fly down - content enters from above */
export function flyDown(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    y = SLIDE_DISTANCE.md,
    easing = cubicOut,
  }: FlyParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateY = (1 - t) * -y;
      return `
        opacity: ${t};
        transform: translateY(${translateY}px);
      `;
    },
  };
}

/** Fly left - content enters from right */
export function flyLeft(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    x = SLIDE_DISTANCE.md,
    easing = cubicOut,
  }: FlyParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateX = (1 - t) * x;
      return `
        opacity: ${t};
        transform: translateX(${translateX}px);
      `;
    },
  };
}

/** Fly right - content enters from left */
export function flyRight(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    x = SLIDE_DISTANCE.md,
    easing = cubicOut,
  }: FlyParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateX = (1 - t) * -x;
      return `
        opacity: ${t};
        transform: translateX(${translateX}px);
      `;
    },
  };
}

// ============================================================================
// SCALE TRANSITIONS
// ============================================================================

export interface ScaleParams {
  delay?: number;
  duration?: number;
  start?: number;
  easing?: (t: number) => number;
}

/** Scale pop - subtle zoom for cards/modals */
export function scalePop(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    start = 0.95,
    easing = backOut,
  }: ScaleParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const scale = start + (1 - start) * t;
      return `
        opacity: ${t};
        transform: scale(${scale});
      `;
    },
  };
}

/** Scale spring - bouncy zoom with overshoot */
export function scaleSpring(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.emphasis,
    start = 0.9,
    easing = quintOut,
  }: ScaleParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const scale = start + (1 - start) * t;
      return `
        opacity: ${t};
        transform: scale(${scale});
      `;
    },
  };
}

// ============================================================================
// COMBINED TRANSITIONS (fly + scale for depth)
// ============================================================================

export interface CombinedParams {
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  scale?: number;
  easing?: (t: number) => number;
}

/** Fly up with subtle scale - adds depth perception */
export function flyUpScale(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    y = SLIDE_DISTANCE.md,
    scale = 0.98,
    easing = cubicOut,
  }: CombinedParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateY = (1 - t) * y;
      const currentScale = scale + (1 - scale) * t;
      return `
        opacity: ${t};
        transform: translateY(${translateY}px) scale(${currentScale});
      `;
    },
  };
}

/** Fly down with subtle scale */
export function flyDownScale(
  _node: Element,
  {
    delay = 0,
    duration = DURATION.normal,
    y = SLIDE_DISTANCE.md,
    scale = 0.98,
    easing = cubicOut,
  }: CombinedParams = {}
): TransitionConfig {
  return {
    delay,
    duration,
    easing,
    css: (t) => {
      const translateY = (1 - t) * -y;
      const currentScale = scale + (1 - scale) * t;
      return `
        opacity: ${t};
        transform: translateY(${translateY}px) scale(${currentScale});
      `;
    },
  };
}

// ============================================================================
// STAGGERED HELPERS
// ============================================================================

/**
 * Calculate staggered delay for list items
 * @param index - Item index in the list
 * @param baseDelay - Initial delay before staggering starts
 * @param staggerMs - Milliseconds between each item (default: STAGGER.normal)
 */
export function staggerDelay(
  index: number,
  baseDelay: number = 0,
  staggerMs: number = STAGGER.normal
): number {
  return baseDelay + index * staggerMs;
}

/**
 * Calculate staggered delay with a maximum cap
 * Prevents very long delays for long lists
 */
export function staggerDelayCapped(
  index: number,
  baseDelay: number = 0,
  staggerMs: number = STAGGER.normal,
  maxDelay: number = 400
): number {
  const calculatedDelay = baseDelay + index * staggerMs;
  return Math.min(calculatedDelay, maxDelay);
}

// ============================================================================
// PRESET CONFIGURATIONS
// For quick use in components: in:flyUp={presets.cardEnter}
// ============================================================================

export const presets = {
  /** Cards entering a grid/list */
  cardEnter: {
    duration: DURATION.normal,
    y: SLIDE_DISTANCE.md,
  },

  /** Modal/dialog appearing */
  modalEnter: {
    duration: DURATION.emphasis,
    start: 0.95,
  },

  /** Subtle header entrance */
  headerEnter: {
    duration: DURATION.normal,
    y: -SLIDE_DISTANCE.sm,
  },

  /** Quick toast/notification */
  toastEnter: {
    duration: DURATION.fast,
    y: SLIDE_DISTANCE.sm,
  },

  /** Widget panel entrance */
  widgetEnter: {
    duration: DURATION.normal,
    y: SLIDE_DISTANCE.md,
  },
} as const;
