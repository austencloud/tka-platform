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
import type {
  Trails3DParams,
  Fire3DParams,
  Led3DParams,
  Charcoal3DParams,
  Zap3DParams,
  Sparkles3DParams,
  Echo3DParams,
  Bloom3DParams,
} from "./webgl3d-types";

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
    kernelSize: Math.max(3, Math.round(3 + intent.radius * 9)),
    mipLevels: Math.max(2, Math.round(2 + intent.radius * 4)),
  };
  return { ...intent, ...defaults, ...override };
}
