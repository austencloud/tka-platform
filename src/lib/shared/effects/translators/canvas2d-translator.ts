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
  Trails2DParams,
  Fire2DParams,
  Led2DParams,
  Charcoal2DParams,
  Zap2DParams,
  Sparkles2DParams,
  Echo2DParams,
  Bloom2DParams,
} from "./canvas2d-types";

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
    blurRadiusPx: 8 + intent.radius * 32,
    passes: Math.max(1, Math.round(1 + intent.radius * 3)),
  };
  return { ...intent, ...defaults, ...override };
}
