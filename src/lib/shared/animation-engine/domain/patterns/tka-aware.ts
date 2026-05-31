import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

const TWO_PI = Math.PI * 2;

/** Clamp a value to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Proximity pattern: tips glow brighter when they're physically close to
 * any tip from the other prop (or any tip in the previous frame).
 * Distance is in canvas pixels. Tips further than 400px are dim,
 * tips within ~50px are near full brightness.
 *
 * Useful for choreography that involves close passes - the tips light up
 * just as the props approach each other.
 */
export function evaluateProximity(ctx: TipEvaluationContext): LedColor {
  const { x, y, prevFrameTips, primaryColor } = ctx;
  let brightness = 0.5;

  if (prevFrameTips.length > 0) {
    let minDist = Infinity;
    for (const tip of prevFrameTips) {
      const dx = x - tip.x;
      const dy = y - tip.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    brightness = 1 - clamp(minDist / 400, 0, 1);
  }

  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Velocity pattern: brighter when the prop is moving fast, dimmer when slow.
 * Speed is in canvas pixels per second. Fully bright at 3000 px/s, dim (not off)
 * at rest - so there's always a faint glow even during still moments.
 *
 * Good for emphasizing fast throws and directional changes.
 */
export function evaluateVelocity(ctx: TipEvaluationContext): LedColor {
  const { speedMagnitude, primaryColor } = ctx;
  const brightness = clamp(speedMagnitude / 3000, 0.1, 1.0);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Mirror Sync pattern: both props breathe together, but prop 1 is a half-cycle
 * out of phase with prop 0. When one glows bright, the other is dim.
 *
 * Visually: the two props "trade" brightness back and forth like a mirror.
 * Good for parallel or mirrored choreography where complementary timing matters.
 */
export function evaluateMirrorSync(ctx: TipEvaluationContext): LedColor {
  const { time, speed, propIndex, primaryColor } = ctx;
  const t = time * speed;
  const phase = propIndex === 0 ? 0 : Math.PI;
  const brightness = 0.5 + 0.5 * Math.sin(t * TWO_PI + phase);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Beat Pulse pattern: a sharp flash fires at the start of each musical beat.
 * Speed controls the BPM (speed * 60 beats per minute). The flash decays
 * quadratically so it's bright right on the beat and dark before the next one.
 *
 * Only meaningful when the animation is synced to a musical beat grid.
 * With speed=2, BPM=120 which is typical dance music.
 */
export function evaluateBeatPulse(ctx: TipEvaluationContext): LedColor {
  const { time, speed, primaryColor } = ctx;
  const bpm = speed * 60;
  const beatPhase = ((time * bpm) / 60) % 1;
  const brightness = Math.pow(Math.max(0, 1 - beatPhase * 4), 2);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}
