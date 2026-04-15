/**
 * Backend-neutral render pass description.
 *
 * Produced by translators from intents (TrailsIntent, FireIntent, …) and
 * consumed by concrete RenderBackend implementations. The pass descriptor
 * is the pact between the intent layer and the GPU.
 */

export type RenderPassKind =
  | "props"
  | "grid"
  | "glyph"
  | "trail"
  | "fire"
  | "led"
  | "charcoal"
  | "zap"
  | "sparkles"
  | "motion"
  | "bloom"
  | "composite";

/**
 * Canonical z-order per pass kind. Higher = drawn later (on top).
 * Trails sit behind props; bloom composites last.
 */
export const Z_ORDER = {
  GRID: 10,
  GLYPH: 20,
  TRAIL: 40,
  CHARCOAL: 45,
  PROPS: 50,
  LED: 55,
  FIRE: 60,
  ZAP: 65,
  SPARKLES: 70,
  MOTION: 75,
  BLOOM: 80,
  COMPOSITE: 100,
} as const;

/** Discriminated FBO target names. Backends manage the underlying GPU resources. */
export type RenderTarget =
  | "scene"
  | "bloom-input"
  | `trail-${string}`
  | `custom-${string}`;

export interface RenderPassDescriptor {
  /** Stable pass identity for caching shader programs, FBOs, etc. */
  kind: RenderPassKind;
  /** Z-order within the frame. Lower renders first. */
  order: number;
  /** Which FBO this pass writes to. Backends resolve the name to a concrete target. */
  target: RenderTarget;
  /** Backend-specific payload. Each kind has a typed payload shape co-located with its translator. */
  payload: unknown;
  /** Inputs this pass samples. Enables dependency analysis / barriers. */
  reads?: string[];
}
