/**
 * Easing Functions
 *
 * Common easing functions for animations.
 * MIT-compatible replacements for GSAP easings.
 * Based on Robert Penner's easing equations.
 */

export type EasingFunction = (t: number) => number;

/**
 * Linear - no easing
 */
export const linear: EasingFunction = (t) => t;

/**
 * Power1 (Quad) easings
 */
export const power1In: EasingFunction = (t) => t * t;
export const power1Out: EasingFunction = (t) => 1 - (1 - t) * (1 - t);
export const power1InOut: EasingFunction = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Power2 (Cubic) easings
 */
export const power2In: EasingFunction = (t) => t * t * t;
export const power2Out: EasingFunction = (t) => 1 - Math.pow(1 - t, 3);
export const power2InOut: EasingFunction = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Power3 (Quart) easings
 */
export const power3In: EasingFunction = (t) => t * t * t * t;
export const power3Out: EasingFunction = (t) => 1 - Math.pow(1 - t, 4);
export const power3InOut: EasingFunction = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

/**
 * Power4 (Quint) easings
 */
export const power4In: EasingFunction = (t) => t * t * t * t * t;
export const power4Out: EasingFunction = (t) => 1 - Math.pow(1 - t, 5);
export const power4InOut: EasingFunction = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

/**
 * Sine easings
 */
export const sineIn: EasingFunction = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const sineOut: EasingFunction = (t) => Math.sin((t * Math.PI) / 2);
export const sineInOut: EasingFunction = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Expo easings
 */
export const expoIn: EasingFunction = (t) =>
  t === 0 ? 0 : Math.pow(2, 10 * t - 10);
export const expoOut: EasingFunction = (t) =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const expoInOut: EasingFunction = (t) =>
  t === 0
    ? 0
    : t === 1
      ? 1
      : t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;

/**
 * Circ easings
 */
export const circIn: EasingFunction = (t) => 1 - Math.sqrt(1 - Math.pow(t, 2));
export const circOut: EasingFunction = (t) => Math.sqrt(1 - Math.pow(t - 1, 2));
export const circInOut: EasingFunction = (t) =>
  t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

/**
 * Back easings (with overshoot)
 */
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;

export const backIn: EasingFunction = (t) => c3 * t * t * t - c1 * t * t;
export const backOut: EasingFunction = (t) =>
  1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
export const backInOut: EasingFunction = (t) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

/**
 * Elastic easings
 */
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

export const elasticIn: EasingFunction = (t) =>
  t === 0
    ? 0
    : t === 1
      ? 1
      : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
export const elasticOut: EasingFunction = (t) =>
  t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
export const elasticInOut: EasingFunction = (t) =>
  t === 0
    ? 0
    : t === 1
      ? 1
      : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;

/**
 * Bounce easings
 */
const n1 = 7.5625;
const d1 = 2.75;

export const bounceOut: EasingFunction = (t) => {
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};
export const bounceIn: EasingFunction = (t) => 1 - bounceOut(1 - t);
export const bounceInOut: EasingFunction = (t) =>
  t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;

/**
 * Easing name to function lookup
 * Maps GSAP-style easing names to functions
 */
export const EASING_MAP: Record<string, EasingFunction> = {
  // Linear
  none: linear,
  linear: linear,

  // Power1 (Quad)
  "power1.in": power1In,
  "power1.out": power1Out,
  "power1.inOut": power1InOut,

  // Power2 (Cubic) - GSAP default
  "power2.in": power2In,
  "power2.out": power2Out,
  "power2.inOut": power2InOut,

  // Power3 (Quart)
  "power3.in": power3In,
  "power3.out": power3Out,
  "power3.inOut": power3InOut,

  // Power4 (Quint)
  "power4.in": power4In,
  "power4.out": power4Out,
  "power4.inOut": power4InOut,

  // Sine
  "sine.in": sineIn,
  "sine.out": sineOut,
  "sine.inOut": sineInOut,

  // Expo
  "expo.in": expoIn,
  "expo.out": expoOut,
  "expo.inOut": expoInOut,

  // Circ
  "circ.in": circIn,
  "circ.out": circOut,
  "circ.inOut": circInOut,

  // Back
  "back.in": backIn,
  "back.out": backOut,
  "back.inOut": backInOut,

  // Elastic
  "elastic.in": elasticIn,
  "elastic.out": elasticOut,
  "elastic.inOut": elasticInOut,

  // Bounce
  "bounce.in": bounceIn,
  "bounce.out": bounceOut,
  "bounce.inOut": bounceInOut,
};

/**
 * Get easing function by name
 * Falls back to power2.inOut if not found (GSAP default)
 */
export function getEasing(name: string): EasingFunction {
  return EASING_MAP[name.toLowerCase()] || power2InOut;
}
