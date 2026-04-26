/**
 * LED pass payload.
 *
 * Instanced point sprites along the prop shaft, driven by a pattern
 * function. Backend renders as instanced quads with bloom post-process.
 */

export interface LedSegment {
  /** Position in NDC. */
  position: [number, number];
  /** RGB color 0..1. */
  color: [number, number, number];
  /** 0..1 brightness at this segment. */
  brightness: number;
}

export interface LedTipState {
  tipId: string;
  /** Ordered LED positions along the prop shaft, base→tip. */
  segments: LedSegment[];
  /** Overall brightness multiplier 0..1. */
  brightness: number;
  /** Enable motion streak accumulation. */
  motionStreak: boolean;
  /** Streak decay rate (like trail decay). */
  streakDecayPerSecond: number;
}

export interface LedPassPayload {
  tips: LedTipState[];
  /** Bloom radius in pixels. 0 disables. */
  bloomRadius: number;
  /** Bloom intensity multiplier. */
  bloomIntensity: number;
}
