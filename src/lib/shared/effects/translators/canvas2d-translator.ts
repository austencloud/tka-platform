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
  Trails2DParams,
  Fire2DParams,
  Led2DParams,
  Charcoal2DParams,
  Zap2DParams,
  Sparkles2DParams,
  Echo2DParams,
  Bloom2DParams,
  Water2DParams,
  Bubbles2DParams,
  Petals2DParams,
  Smoke2DParams,
} from "./canvas2d-types";
import { resolveWaterPalette } from "../domain/WaterPalettes";
import { resolveBubblePalette } from "../domain/BubblePalettes";
import { resolvePetalPalette } from "../domain/PetalPalettes";
import { resolveSmokePalette } from "../domain/SmokePalettes";

export function resolveTrails2D(
  intent: TrailsIntent,
  override: Partial<Trails2DParams> = {},
): Trails2DParams {
  const defaults: Omit<Trails2DParams, keyof TrailsIntent> = {
    lineWidth: intent.thickness,
    maxOpacity: intent.brightness,
    minOpacity: intent.brightness * 0.3,
    glowBlur: 3,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveFire2D(
  intent: FireIntent,
  override: Partial<Fire2DParams> = {},
): Fire2DParams {
  return { ...intent, ...override };
}

export function resolveLed2D(
  intent: LedIntent,
  override: Partial<Led2DParams> = {},
): Led2DParams {
  const defaults: Omit<Led2DParams, keyof LedIntent> = {
    dotRadius: 2,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveCharcoal2D(
  intent: CharcoalIntent,
  override: Partial<Charcoal2DParams> = {},
): Charcoal2DParams {
  const defaults: Omit<Charcoal2DParams, keyof CharcoalIntent> = {
    particleCount: 200,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveZap2D(
  intent: ZapIntent,
  override: Partial<Zap2DParams> = {},
): Zap2DParams {
  const defaults: Omit<Zap2DParams, keyof ZapIntent> = {
    segments: Math.max(4, Math.round(6 + intent.intensity * 10)),
    jitterAmount: 6 + intent.intensity * 10,
    glowBlur: 8 + intent.intensity * 12,
    lineWidth: 1.5 + intent.intensity * 1.5,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveSparkles2D(
  intent: SparklesIntent,
  override: Partial<Sparkles2DParams> = {},
): Sparkles2DParams {
  const defaults: Omit<Sparkles2DParams, keyof SparklesIntent> = {
    poolSize: 256,
    baseRadius: 3,
    blendMode: "lighter",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveEcho2D(
  intent: EchoIntent,
  override: Partial<Echo2DParams> = {},
): Echo2DParams {
  const defaults: Omit<Echo2DParams, keyof EchoIntent> = {
    blendMode: "lighter",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBloom2D(
  intent: BloomIntent,
  override: Partial<Bloom2DParams> = {},
): Bloom2DParams {
  const defaults: Omit<Bloom2DParams, keyof BloomIntent> = {
    blendMode: "lighter",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveWater2D(
  intent: WaterIntent,
  override: Partial<Water2DParams> = {},
): Water2DParams {
  const defaults: Omit<Water2DParams, keyof WaterIntent> = {
    resolvedPalette: resolveWaterPalette(intent),
    poolSize: 1024,
    baseRadius: 4,
    ambientSpawnRate: 8,
    motionSpawnRate: 40,
    motionReferenceSpeed: 3.0,
    blendMode: "source-over",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBubbles2D(
  intent: BubblesIntent,
  override: Partial<Bubbles2DParams> = {},
): Bubbles2DParams {
  const defaults: Omit<Bubbles2DParams, keyof BubblesIntent> = {
    resolvedPalette: resolveBubblePalette(intent),
    poolSize: 1024,
    baseRadius: 6,
    ambientSpawnRate: 6,
    motionSpawnRate: 30,
    motionReferenceSpeed: 3.0,
    blendMode: "source-over",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolvePetals2D(
  intent: PetalsIntent,
  override: Partial<Petals2DParams> = {},
): Petals2DParams {
  const defaults: Omit<Petals2DParams, keyof PetalsIntent> = {
    resolvedPalette: resolvePetalPalette(intent),
    poolSize: 1024,
    baseSize: 10,
    ambientSpawnRate: 5,
    motionSpawnRate: 25,
    motionReferenceSpeed: 3.0,
    fallBaseSpeed: 140,
    swayBaseSpeed: 80,
    swayFrequency: 1.4,
    blendMode: "source-over",
  };
  return { ...intent, ...defaults, ...override };
}

/**
 * Resolve smoke for the 2D backend.
 *
 * Composes user intent with palette behavioral multipliers:
 *   - lifetimeSeconds       = palette.lifetime (±20% per-particle jitter at spawn)
 *   - resolvedCurlStrength  = intent.curlStrength * palette.curlBias
 *   - resolvedRiseSpeed     = intent.riseSpeed * palette.riseBias * RISE_BASE
 *
 * The renderer reads only the resolved fields — palette colors flow
 * through `resolvedPalette.core/edge`. This matches the spec's
 * "palette owns lifetime/curl/rise" contract.
 */
export function resolveSmoke2D(
  intent: SmokeIntent,
  override: Partial<Smoke2DParams> = {},
): Smoke2DParams {
  const palette = resolveSmokePalette(intent);
  // Spec tuning constants. RISE_BASE is the screen-space px/s rise at
  // slider=1 before palette bias. 2D uses px, so a tuned absolute value
  // replaces 3D's world-unit value.
  // Boussinesq buoyancy target velocity at riseSpeed=1, palette.riseBias=1
  // and temperature=1. The renderer advects vy toward this target with
  // linear drag (DRAG=0.6/s) — time constant ≈1.7s — so the target is an
  // upper bound that long-lived puffs approach asymptotically. Short-lived
  // genie puffs only reach ~60% of target before cooling. Value tuned
  // against Bridson 2007 + Boussinesq approximation for visual plausibility.
  const RISE_BASE_PX = 280;
  const defaults: Omit<Smoke2DParams, keyof SmokeIntent> = {
    resolvedPalette: palette,
    poolSize: 1024,
    baseRadius: 18,
    ambientSpawnRate: 4,
    motionSpawnRate: 20,
    motionReferenceSpeed: 3.0,
    lifetimeSeconds: palette.lifetime,
    resolvedCurlStrength: intent.curlStrength * palette.curlBias,
    resolvedRiseSpeed: intent.riseSpeed * palette.riseBias * RISE_BASE_PX,
    noiseScale: 0.5,
    riseBaseSpeed: RISE_BASE_PX,
    blendMode: "source-over",
  };
  return { ...intent, ...defaults, ...override };
}
