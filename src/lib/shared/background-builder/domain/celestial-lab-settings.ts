import type { QualityLevel } from "@austencloud/backgrounds";
import {
  DEFAULT_CELESTIAL_LAB_SETTINGS,
  type CelestialLabSettings,
} from "./lab-settings-types";

const CELESTIAL_QUALITY_LEVELS = new Set<QualityLevel>([
  "high",
  "medium",
  "low",
  "minimal",
  "ultra-minimal",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeCelestialLabSettings(
  value: unknown
): CelestialLabSettings {
  const settings = isRecord(value) ? value : {};
  const layers = isRecord(settings.layers) ? settings.layers : {};
  const quality =
    typeof settings.quality === "string" &&
    CELESTIAL_QUALITY_LEVELS.has(settings.quality as QualityLevel)
      ? (settings.quality as QualityLevel)
      : DEFAULT_CELESTIAL_LAB_SETTINGS.quality;

  return {
    quality,
    layers: {
      clouds:
        typeof layers.clouds === "boolean"
          ? layers.clouds
          : DEFAULT_CELESTIAL_LAB_SETTINGS.layers.clouds,
      sunGlow:
        typeof layers.sunGlow === "boolean"
          ? layers.sunGlow
          : DEFAULT_CELESTIAL_LAB_SETTINGS.layers.sunGlow,
      atmosphere:
        typeof layers.atmosphere === "boolean"
          ? layers.atmosphere
          : DEFAULT_CELESTIAL_LAB_SETTINGS.layers.atmosphere,
      vignette:
        typeof layers.vignette === "boolean"
          ? layers.vignette
          : DEFAULT_CELESTIAL_LAB_SETTINGS.layers.vignette,
    },
  };
}
