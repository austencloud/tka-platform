import type { EffectConfig } from "../domain/types";
import type { FireOverlayConfig } from "$lib/shared/animation-engine/domain/types/fire-types";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/led-types";
import type {
  TrailMode} from "$lib/shared/animation-engine/domain/types/trail-types";
import {
  TrailEffect,
  TrackingMode,
  type TrailSettings,
} from "$lib/shared/animation-engine/domain/types/trail-types";

export function toFireConfig(effect: EffectConfig["fire"]): FireOverlayConfig {
  return {
    intensity: effect.intensity,
    flameHeight: effect.flameHeight,
    velocityReactive: true,
    quality: 3,
    colorBlend: effect.colorBlend,
  };
}

export function toLedConfig(effect: EffectConfig["led"]): LedOverlayConfig {
  return {
    enabled: effect.enabled,
    glowRadius: effect.glowRadius,
    bloomIntensity: effect.bloom,
    trailFadeRate: 0.92,
    patternId: effect.patternId,
    patternSpeed: 1.0,
    primaryColor: effect.color,
    secondaryColor: "#ffffff",
    brightness: effect.brightness,
    colorMode: "unified",
    blueHandColor: effect.color,
    redHandColor: effect.color,
  };
}

export function toTrailSettings(effect: EffectConfig["trails"]): TrailSettings {
  // Convert a frame-count length to a fade duration in milliseconds.
  // Assuming 60fps: length frames * (1000ms / 60frames) gives the fade window.
  const fadeDurationMs = (effect.length * 1000) / 60;

  return {
    mode: effect.mode as TrailMode,
    effect: effect.glow ? TrailEffect.GLOW : TrailEffect.NONE,
    fadeDurationMs,
    maxPoints: effect.length * 4,
    lineWidth: effect.width,
    glowBlur: effect.glow ? 8 : 0,
    blueColor: effect.color.blue,
    redColor: effect.color.red,
    additionalLayerColors: [],
    minOpacity: 1 - effect.fade,
    maxOpacity: 1.0,
    trackingMode: TrackingMode.BOTH_ENDS,
    hideProps: false,
    usePathCache: false,
    previewMode: false,
    tailLength: 20,
  };
}
