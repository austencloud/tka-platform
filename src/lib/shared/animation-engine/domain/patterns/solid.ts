import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

/**
 * Solid pattern: all tips emit the primary color at full intensity.
 * The simplest possible pattern - no animation, no spatial variation.
 */
export function evaluateSolid(ctx: TipEvaluationContext): LedColor {
  return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
}

/**
 * Split pattern: each prop gets a different color.
 * Prop 0 (right hand) = primary color, prop 1 (left hand) = secondary color.
 * Lets the performer show left/right distinction at a glance.
 */
export function evaluateSplit(ctx: TipEvaluationContext): LedColor {
  if (ctx.propIndex === 0) {
    return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
  }
  return { r: ctx.secondaryColor.r, g: ctx.secondaryColor.g, b: ctx.secondaryColor.b };
}

/**
 * Quad pattern: four distinct colors, one per tip-slot combination.
 * Derived from primary + secondary + two blends so all four are related
 * but visually distinguishable. Each prop has two different tip colors.
 *
 * Color assignment by (propIndex, tipIndex):
 *   (0, 0) → primary
 *   (0, 1) → secondary
 *   (1, 0) → primary shifted toward blue
 *   (1, 1) → primary shifted toward red
 */
export function evaluateQuad(ctx: TipEvaluationContext): LedColor {
  const { primaryColor: p, secondaryColor: s, propIndex, tipIndex } = ctx;
  const tip = Math.min(tipIndex, 1);
  const slot = propIndex * 2 + tip;

  switch (slot) {
    case 0: // (propIndex=0, tipIndex=0)
      return { r: p.r, g: p.g, b: p.b };
    case 1: // (propIndex=0, tipIndex=1)
      return { r: s.r, g: s.g, b: s.b };
    case 2: // (propIndex=1, tipIndex=0) - primary shifted toward blue
      return {
        r: p.r * 0.3,
        g: p.g * 0.5,
        b: Math.min(1, p.b + 0.5),
      };
    case 3: // (propIndex=1, tipIndex=1) - primary shifted toward red
    default:
      return {
        r: Math.min(1, p.r + 0.5),
        g: p.g * 0.3,
        b: p.b * 0.5,
      };
  }
}
