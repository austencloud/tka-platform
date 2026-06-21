/**
 * WebGL 3D backend parameter interfaces.
 *
 * Each extends the intent layer with 3D-specific extras that have
 * no 2D analog (volumetric density, bloom contribution, tube radius,
 * etc.). The translator derives them from the intent; users never
 * see them.
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
  WaterIntent,
  BubblesIntent,
  PetalsIntent,
  SmokeIntent,
  InkIntent,
  FrostIntent,
} from "../domain/effects-config";
import type { WaterPalette } from "../domain/water-palettes";
import type { BubblePalette } from "../domain/bubble-palettes";
import type { PetalPalette } from "../domain/petal-palettes";
import type { SmokePalette } from "../domain/smoke-palettes";
import type { InkPalette } from "$lib/shared/3d/effects/ink/ink-palettes";
import type { FrostPalette } from "../domain/frost-palettes";

export interface Trails3DParams extends TrailsIntent {
  /** World-space tube radius, meters. Derived from thickness. */
  tubeRadius: number;
  /** Ring buffer length. Renderer-internal; user never sees this. */
  maxPoints: number;
  /** HDR emissive multiplier. Derived from brightness. */
  emissive: number;
  /** 0-1. Weight into the bloom post-process. */
  bloomWeight: number;
  /** "exponential" | "linear" - fade shape along the ring. */
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
  /**
   * HDR core emissive multiplier fed to the particle material's uEmissiveHot
   * uniform. This is what crosses the scene bloom threshold — the lever that
   * tames the blown-out-white flame. Derived from intent.brightness.
   */
  emissiveHot: number;
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
   *  Distinct from intent.gravity (0-1 normalized) - this is the resolved
   *  3D world-space value derived from intent.gravity. */
  worldGravity: number;
}

export interface Echo3DParams extends EchoIntent {
  /** Max phantom mesh count per prop (ring buffer). Derived from decay / interval. */
  poolSize: number;
}

export interface Bloom3DParams extends BloomIntent {
  /** World-space sprite scale (derived from radius). 28 px ≈ 1.12 world units. */
  spriteScale: number;
  /** Texture resolution for the procedural halo sprite (square). */
  textureSize: number;
}

export interface Water3DParams extends WaterIntent {
  /** Resolved palette swatches. */
  resolvedPalette: WaterPalette;
  /** Max instanced droplets. Tier-dependent: 512 / 1024 / 2048. */
  poolSize: number;
  /** World-units - base billboard radius (applied before `intensity`). */
  baseRadius: number;
  /** Droplets/sec at `ambientEmission=1`. */
  ambientSpawnRate: number;
  /** Droplets/sec at full velocity * `motionEmission=1`. */
  motionSpawnRate: number;
  /** World units/s mapping to full motion scalar. */
  motionReferenceSpeed: number;
  /** World-space gravity (−y is down). */
  worldGravity: number;
}

export interface Bubbles3DParams extends BubblesIntent {
  /** Resolved palette swatches. */
  resolvedPalette: BubblePalette;
  /** Max instanced bubbles. Tier-dependent: 512 / 1024 / 2048. */
  poolSize: number;
  /** World-units - base billboard radius (applied before `intensity`). */
  baseRadius: number;
  /** Bubbles/sec at `ambientEmission=1`. */
  ambientSpawnRate: number;
  /** Bubbles/sec at full velocity * `motionEmission=1`. */
  motionSpawnRate: number;
  /** World units/s mapping to full motion scalar. */
  motionReferenceSpeed: number;
  /** World-space rise speed scalar (positive = up). Derived from `buoyancy`. */
  riseSpeed: number;
  /** Bubble lifetime in seconds (before size-pop override). */
  lifetime: number;
}

export interface Petals3DParams extends PetalsIntent {
  /** Resolved palette (sprite list + tint range). */
  resolvedPalette: PetalPalette;
  /** Max instanced petals. Tier-dependent: 512 / 1024 / 2048. */
  poolSize: number;
  /** World-units - base petal size (applied before `intensity`). */
  baseSize: number;
  /** Petals/sec at `ambientEmission=1` spawned from the above-scene ceiling zone. */
  ambientAboveRate: number;
  /** Petals/sec at full velocity * `motionEmission=1` spawned from tip. */
  motionTipRate: number;
  /** World units/s mapping to full motion scalar. */
  motionReferenceSpeed: number;
  /** World-space downward speed scalar at `fallSpeed=1`. */
  fallBaseSpeed: number;
  /** World-space sinusoidal sway amplitude at `swayAmplitude=1`. */
  swayBaseSpeed: number;
  /** Hz - sinusoidal sway frequency. */
  swayFrequency: number;
  /** Petal lifetime in seconds. */
  lifetime: number;
}

export interface Smoke3DParams extends SmokeIntent {
  /** Resolved palette (core/edge colors + behavior multipliers). */
  resolvedPalette: SmokePalette;
  /** Max instanced puffs. Tier-dependent: 512 / 1024 / 2048. */
  poolSize: number;
  /** World-units - base billboard radius before `intensity`. */
  baseRadius: number;
  /** Puffs/sec at `ambientEmission=1`. */
  ambientSpawnRate: number;
  /** Puffs/sec at full velocity * `motionEmission=1`. */
  motionSpawnRate: number;
  /** World units/s mapping to full motion scalar. */
  motionReferenceSpeed: number;
  /** Resolved puff lifetime in seconds (palette.lifetime; jittered at spawn). */
  lifetimeSeconds: number;
  /** Resolved curl magnitude = intent.curlStrength * palette.curlBias. */
  resolvedCurlStrength: number;
  /** Resolved rise speed (world-units/s) = intent.riseSpeed * palette.riseBias * RISE_BASE. */
  resolvedRiseSpeed: number;
  /** World-units per radian of noise space. Matches spec NOISE_SCALE ≈ 0.5. */
  noiseScale: number;
  /** Base world-up rise magnitude in m/s before user/palette multipliers. Spec RISE_BASE ≈ 1.5. */
  riseBaseSpeed: number;
}

export interface Ink3DParams extends InkIntent {
  /**
   * Resolved palette (pigment + edge + splatter + pool + behavior flags).
   * Sprint 1 3D renderer (not yet wired) reads pigment + edge + the
   * emissive/watercolor flags; splatter/pool tints are sprint-2 consumers.
   */
  resolvedPalette: InkPalette;
  /**
   * Resolved effective ambient after the motion-dominant hard cap.
   * Same formula as 2D: `min(intent.ambientEmission, 0.3)`.
   */
  effectiveAmbient: number;
  /**
   * World-units - base stroke radius (tube radius for 3D ribbon mesh).
   * Watercolor palette doubles this (wider bleed). Slow tip presses to
   * this maximum; fast tip lifts to strokeWidthMinWorld.
   */
  strokeWidthMaxWorld: number;
  /** World-units - min stroke radius at high tip speed (brush lifting). */
  strokeWidthMinWorld: number;
  /** Max alpha at peak (0-1). Watercolor palette caps this at 0.4. */
  opacityMax: number;
  /**
   * Material flag: when true, use emissive/additive blend (neon only).
   * Default false → opaque flat-shaded pigment (the #1 differentiator
   * from trails, which are all emissive).
   */
  emissiveMaterial: boolean;
  /** Seconds - stroke-point lifetime. */
  lifetimeSeconds: number;
  /** Max stroke points per tip (bounded history). */
  maxPointsPerTip: number;
  /** World units/s mapping to full motion scalar. Spec MOTION_REFERENCE_SPEED=3.0. */
  motionReferenceSpeed: number;
}

export interface Frost3DParams extends FrostIntent {
  /** Resolved palette swatches. */
  resolvedPalette: FrostPalette;
  /** Max instanced aura particles. Tier-dependent: 512 / 1024 / 2048. */
  auraPoolSize: number;
  /** World-units - base aura billboard radius. */
  baseRadius: number;
  /** Particles/sec at `ambientEmission=1`. */
  ambientSpawnRate: number;
  /** Particles/sec at full velocity * `motionEmission=1`. */
  motionSpawnRate: number;
  /** World units/s mapping to full motion scalar. */
  motionReferenceSpeed: number;
  /** Particle lifetime range low (seconds). */
  lifetimeMin: number;
  /** Particle lifetime range high (seconds). */
  lifetimeMax: number;
}
