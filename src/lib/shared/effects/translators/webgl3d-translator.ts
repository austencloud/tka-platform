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
} from "../domain/EffectsConfig";
import type {
  Trails3DParams,
  Fire3DParams,
  Led3DParams,
  Charcoal3DParams,
  Zap3DParams,
  Sparkles3DParams,
  Echo3DParams,
  Bloom3DParams,
  Water3DParams,
  Bubbles3DParams,
  Petals3DParams,
  Smoke3DParams,
} from "./webgl3d-types";
import { resolveWaterPalette } from "../domain/WaterPalettes";
import { resolveBubblePalette } from "../domain/BubblePalettes";
import { resolvePetalPalette } from "../domain/PetalPalettes";
import { resolveSmokePalette } from "../domain/SmokePalettes";

export function resolveTrails3D(
  intent: TrailsIntent,
  override: Partial<Trails3DParams> = {},
): Trails3DParams {
  const defaults: Omit<Trails3DParams, keyof TrailsIntent> = {
    tubeRadius: intent.thickness * 0.008, // 0.008-0.096 world units
    maxPoints: 256,
    emissive: intent.brightness * 2.0, // HDR > 1.0
    bloomWeight: intent.brightness * 0.4,
    taperCurve: "exponential",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveFire3D(
  intent: FireIntent,
  override: Partial<Fire3DParams> = {},
): Fire3DParams {
  const defaults: Omit<Fire3DParams, keyof FireIntent> = {
    volumetricDensity: 0.3 + intent.intensity * 0.7,
    emissionRate: 200 + intent.intensity * 800,
    buoyancy: 1.2 + intent.intensity * 0.8,
    dragCoefficient: 0.15,
    vortexStrength: intent.turbulence * 3.0,
    shadowCasting: false,
    bloomContribution: intent.intensity * 0.6,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveLed3D(
  intent: LedIntent,
  override: Partial<Led3DParams> = {},
): Led3DParams {
  const defaults: Omit<Led3DParams, keyof LedIntent> = {
    segmentCount: 200,
    povPersistenceDuration: 0.12,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveCharcoal3D(
  intent: CharcoalIntent,
  override: Partial<Charcoal3DParams> = {},
): Charcoal3DParams {
  const defaults: Omit<Charcoal3DParams, keyof CharcoalIntent> = {
    particleLifetime: 0.5 + intent.glow * 1.5,
    gravity: -2.0, // upward drift for charcoal sparks
    sparkSizeJitter: 0.4,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveZap3D(
  intent: ZapIntent,
  override: Partial<Zap3DParams> = {},
): Zap3DParams {
  const defaults: Omit<Zap3DParams, keyof ZapIntent> = {
    segments: Math.max(4, Math.round(5 + intent.intensity * 8)),
    jitterAmount: 0.08 + intent.intensity * 0.14,
    pointLightIntensity: intent.intensity > 0.5 ? intent.intensity * 2.0 : 0,
    regenerateEveryFrames: 3,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveSparkles3D(
  intent: SparklesIntent,
  override: Partial<Sparkles3DParams> = {},
): Sparkles3DParams {
  const defaults: Omit<Sparkles3DParams, keyof SparklesIntent> = {
    poolSize: 512,
    baseRadius: 0.03,
    // Map normalized intent.gravity (0=floaty,1=fast fall) to world-units/s.
    // 0 → small upward drift (-0.2), 1 → strong downward pull (+5.0).
    worldGravity: -0.2 + intent.gravity * 5.2,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveEcho3D(
  intent: EchoIntent,
  override: Partial<Echo3DParams> = {},
): Echo3DParams {
  const defaults: Omit<Echo3DParams, keyof EchoIntent> = {
    poolSize: Math.max(2, Math.ceil(intent.decay / intent.interval) + 2),
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBloom3D(
  intent: BloomIntent,
  override: Partial<Bloom3DParams> = {},
): Bloom3DParams {
  const defaults: Omit<Bloom3DParams, keyof BloomIntent> = {
    // Tuned so 28 px 2D ≈ 1.12 world units 3D.
    spriteScale: intent.radius * 0.04,
    textureSize: 128,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveWater3D(
  intent: WaterIntent,
  override: Partial<Water3DParams> = {},
): Water3DParams {
  const defaults: Omit<Water3DParams, keyof WaterIntent> = {
    resolvedPalette: resolveWaterPalette(intent),
    poolSize: 1024,
    baseRadius: 0.04,
    ambientSpawnRate: 8,
    motionSpawnRate: 40,
    motionReferenceSpeed: 3.0,
    worldGravity: -9.8,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBubbles3D(
  intent: BubblesIntent,
  override: Partial<Bubbles3DParams> = {},
): Bubbles3DParams {
  const defaults: Omit<Bubbles3DParams, keyof BubblesIntent> = {
    resolvedPalette: resolveBubblePalette(intent),
    poolSize: 1024,
    baseRadius: 0.07,
    ambientSpawnRate: 6,
    motionSpawnRate: 30,
    motionReferenceSpeed: 3.0,
    // 0.2 m/s at buoyancy=0 → 1.6 m/s at buoyancy=1. Bubbles always rise
    // at least a little — a motionless bubble looks dead.
    riseSpeed: 0.2 + intent.buoyancy * 1.4,
    // 1.0-3.0s lifetime driven by intensity (bigger bubbles last longer
    // before max-size pop takes over).
    lifetime: 1.0 + intent.intensity * 2.0,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolvePetals3D(
  intent: PetalsIntent,
  override: Partial<Petals3DParams> = {},
): Petals3DParams {
  const defaults: Omit<Petals3DParams, keyof PetalsIntent> = {
    resolvedPalette: resolvePetalPalette(intent),
    poolSize: 1024,
    baseSize: 0.1,
    // 3D emission is dual-source: ambient-from-ceiling + motion-from-tip.
    // Ambient rate stays lower than 2D because 3D petals live longer per
    // particle (longer descent path).
    ambientAboveRate: 10,
    motionTipRate: 25,
    motionReferenceSpeed: 3.0,
    // 3D uses +y = up, so falling is negative velocity.
    fallBaseSpeed: 1.4,
    swayBaseSpeed: 0.8,
    swayFrequency: 1.4,
    lifetime: 4.0 + intent.intensity * 4.0,
  };
  return { ...intent, ...defaults, ...override };
}

/**
 * Resolve smoke for the 3D backend.
 *
 * Matches the 2D translator's palette-composition rules; the only 3D-
 * specific bits are world-unit tunings (base radius in meters, rise in
 * m/s). Curl/rise biases are composed the same way:
 *   resolvedCurlStrength = intent.curlStrength * palette.curlBias
 *   resolvedRiseSpeed    = intent.riseSpeed * palette.riseBias * RISE_BASE
 */
export function resolveSmoke3D(
  intent: SmokeIntent,
  override: Partial<Smoke3DParams> = {},
): Smoke3DParams {
  const palette = resolveSmokePalette(intent);
  const RISE_BASE_M = 1.5; // m/sec upward at riseSpeed=1, palette.riseBias=1
  const defaults: Omit<Smoke3DParams, keyof SmokeIntent> = {
    resolvedPalette: palette,
    poolSize: 1024,
    baseRadius: 0.18,
    ambientSpawnRate: 4,
    motionSpawnRate: 20,
    motionReferenceSpeed: 3.0,
    lifetimeSeconds: palette.lifetime,
    resolvedCurlStrength: intent.curlStrength * palette.curlBias,
    resolvedRiseSpeed: intent.riseSpeed * palette.riseBias * RISE_BASE_M,
    noiseScale: 0.5,
    riseBaseSpeed: RISE_BASE_M,
  };
  return { ...intent, ...defaults, ...override };
}
