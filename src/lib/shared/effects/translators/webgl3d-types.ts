/**
 * WebGL 3D backend parameter interfaces.
 *
 * Each extends the intent layer with 3D-specific extras that have
 * no 2D analog (volumetric density, bloom contribution, tube radius,
 * etc.). These populate `EffectsConfig.overrides.*3D` when the user
 * has opened a 3D Advanced panel. Core users never see them.
 */

import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  EchoIntent,
  BloomIntent,
} from "../domain/EffectsConfig";

export interface Trails3DParams extends TrailsIntent {
  /** World-space tube radius, meters. Derived from thickness. */
  tubeRadius: number;
  /** Ring buffer length. Renderer-internal; user never sees this. */
  maxPoints: number;
  /** HDR emissive multiplier. Derived from brightness. */
  emissive: number;
  /** 0-1. Weight into the bloom post-process. */
  bloomWeight: number;
  /** "exponential" | "linear" — fade shape along the ring. */
  taperCurve: "exponential" | "linear";
}

export interface Fire3DParams extends FireIntent {
  /** 0-1. Alpha accumulation along raymarched fire volume. */
  volumetricDensity: number;
  /** Particles/second emitted. */
  emissionRate: number;
  /** Upward force on particles. */
  buoyancy: number;
  /** 0-1. Drag coefficient. */
  dragCoefficient: number;
  /** 0-5. Curl-noise vortex strength. */
  vortexStrength: number;
  /** Whether fire casts light on the environment. */
  shadowCasting: boolean;
  /** 0-1. Bloom post-process contribution. */
  bloomContribution: number;
}

export interface Led3DParams extends LedIntent {
  /** Number of virtual LED segments along the staff. */
  segmentCount: number;
  /** POV persistence duration in seconds. */
  povPersistenceDuration: number;
}

export interface Charcoal3DParams extends CharcoalIntent {
  /** Particle lifetime in seconds. */
  particleLifetime: number;
  /** Gravity strength on particles (world units/s²). */
  gravity: number;
  /** 0-1. Spark size randomization. */
  sparkSizeJitter: number;
}

export interface Zap3DParams extends ZapIntent {
  /** Segment count along each arc. */
  segments: number;
  /** 0-1 world-space jitter displacement per segment. */
  jitterAmount: number;
  /** Point light intensity when intensity > 0.5. */
  pointLightIntensity: number;
  /** Path regeneration interval in frames. */
  regenerateEveryFrames: number;
}

export interface Sparkles3DParams extends SparklesIntent {
  /** Max particles alive at once. */
  poolSize: number;
  /** Point sprite base radius (world units). */
  baseRadius: number;
  /** Per-second gravity applied to particles, world units (negative = rise).
   *  Distinct from intent.gravity (0-1 normalized) — this is the resolved
   *  3D world-space value derived from intent.gravity. */
  worldGravity: number;
}

export interface Echo3DParams extends EchoIntent {
  /** Max phantom mesh count per prop (ring buffer). Derived from decay / interval. */
  poolSize: number;
}

export interface Bloom3DParams extends BloomIntent {
  /** Bloom pass kernel size. */
  kernelSize: number;
  /** Mipmap levels to accumulate for the final bloom buffer. */
  mipLevels: number;
}
