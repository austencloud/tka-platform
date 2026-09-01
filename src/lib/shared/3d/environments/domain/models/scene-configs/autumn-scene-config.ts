/** Controls for the shipped Blender-authored Autumn environment. */

import type { SkyGradientConfig } from "../environment-models";
import type { FogConfig } from "./shared-scene-config";

export interface AutumnStarfieldConfig {
  enabled: boolean;
  countScale: number;
  sizeScale: number;
  intensity: number;
}

export interface AutumnSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  stars: AutumnStarfieldConfig;
  groundDetailStrength: number;
  magicIntensity: number;
}

export function createDefaultAutumnConfig(): AutumnSceneConfig {
  return {
    sky: {
      topColor: "#120b2b",
      midColor: "#38265a",
      // The lowest sky band meets fully fogged geometry. Sharing the fog colour
      // keeps that join atmospheric instead of drawing a lavender horizon line.
      bottomColor: "#2b172f",
    },
    fog: { color: "#2b172f", density: 0.016 },
    stars: {
      enabled: true,
      countScale: 1,
      sizeScale: 1,
      intensity: 1.35,
    },
    groundDetailStrength: 0.9,
    magicIntensity: 1,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function asNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function normalizeAutumnConfig(value: unknown): AutumnSceneConfig {
  const defaults = createDefaultAutumnConfig();
  const candidate = asRecord(value);
  if (!candidate) return defaults;
  const stars = asRecord(candidate.stars);

  // Legacy Scene Lab configs described the deleted procedural tree-ring scene.
  // `stars` is the discriminant for the production GLB-era shape.
  if (!stars) return defaults;

  const sky = asRecord(candidate.sky);
  const fog = asRecord(candidate.fog);

  return {
    sky: {
      topColor: asColor(sky?.topColor, defaults.sky.topColor),
      midColor: asColor(sky?.midColor, defaults.sky.midColor ?? "#000000"),
      bottomColor: asColor(sky?.bottomColor, defaults.sky.bottomColor),
    },
    fog: {
      color: asColor(fog?.color, defaults.fog.color),
      density: asNumber(fog?.density, defaults.fog.density, 0.004, 0.035),
    },
    stars: {
      enabled:
        typeof stars.enabled === "boolean"
          ? stars.enabled
          : defaults.stars.enabled,
      countScale: asNumber(
        stars.countScale,
        defaults.stars.countScale,
        0.25,
        1.5
      ),
      sizeScale: asNumber(stars.sizeScale, defaults.stars.sizeScale, 0.5, 1.5),
      intensity: asNumber(stars.intensity, defaults.stars.intensity, 0.3, 2.5),
    },
    groundDetailStrength: asNumber(
      candidate.groundDetailStrength,
      defaults.groundDetailStrength,
      0,
      1.4
    ),
    magicIntensity: asNumber(
      candidate.magicIntensity,
      defaults.magicIntensity,
      0,
      2
    ),
  };
}
