/**
 * Prop Morph Easing
 *
 * Pure math for the prop-type morph crossfade's visual flourish (2026-07-19
 * hero-attract-act, round 2 feedback): the swap must read as a shape
 * TRANSFORMING, not a plain alpha crossfade. Isolated here (no canvas/ctx
 * dependency) so the curve shapes are unit-testable without a DOM.
 *
 * Consumed by Canvas2DAnimationRenderer's blue/red prop draw steps. All
 * functions take an already-eased 0..1 progress (see easeInOutCosine) and
 * are pure — no shared state, no side effects.
 */

/** Outgoing sprite grows to this scale by the time it's fully faded out
 *  (dissolves outward). 1 = no change. */
export const PROP_MORPH_OUTGOING_PEAK_SCALE = 1.07;

/** Incoming sprite starts at this scale and condenses up to 1 (full size)
 *  as it fades in. */
export const PROP_MORPH_INCOMING_START_SCALE = 0.92;

/** Incoming sprite's glow-pulse peak blur radius, in reference-viewBox (950)
 *  pixels — scaled to the live canvas size by propMorphGlowBlur. */
export const PROP_MORPH_GLOW_PEAK_PX = 18;

/**
 * Cosine ease-in-out: slow-fast-slow, symmetric about t=0.5.
 * Replaces the fade manager's raw linear progress for the morph's alpha,
 * scale, and glow curves so the transform reads as eased motion rather than
 * a linear dissolve. Input is clamped to [0, 1] so an out-of-range caller
 * (shouldn't happen — FadeState always reports 0..1) degrades safely
 * instead of producing a curve that overshoots.
 */
export function easeInOutCosine(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return (1 - Math.cos(clamped * Math.PI)) / 2;
}

/** Outgoing (previous) sprite scale across the fade: 1 at the start ->
 *  PROP_MORPH_OUTGOING_PEAK_SCALE as it finishes dissolving out. */
export function propMorphOutgoingScale(easedProgress: number): number {
  return 1 + (PROP_MORPH_OUTGOING_PEAK_SCALE - 1) * easedProgress;
}

/** Incoming (current) sprite scale across the fade:
 *  PROP_MORPH_INCOMING_START_SCALE at the start -> 1 as it settles into place. */
export function propMorphIncomingScale(easedProgress: number): number {
  return (
    PROP_MORPH_INCOMING_START_SCALE +
    (1 - PROP_MORPH_INCOMING_START_SCALE) * easedProgress
  );
}

/**
 * Incoming sprite's glow-pulse blur radius (px, in the canvas's own pixel
 * space), peaking at the fade's midpoint and zero at both ends. `canvasSize`
 * and `viewboxSize` scale the reference-size peak (PROP_MORPH_GLOW_PEAK_PX,
 * authored against the 950 viewBox) to the live canvas, matching how prop
 * dimensions themselves are scaled (calculatePropTransform's gridScaleFactor).
 */
export function propMorphGlowBlur(
  easedProgress: number,
  canvasSize: number,
  viewboxSize: number
): number {
  if (viewboxSize <= 0) return 0;
  const scale = canvasSize / viewboxSize;
  return PROP_MORPH_GLOW_PEAK_PX * scale * Math.sin(easedProgress * Math.PI);
}
