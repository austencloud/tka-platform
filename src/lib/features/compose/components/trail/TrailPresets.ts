/**
 * Trail Presets
 *
 * Pre-defined trail configurations that users can quickly select.
 * Reduces cognitive load by providing curated "recipes" instead of
 * requiring manual slider adjustments.
 */

import {
  TrailMode,
  FadeStyle,
  TaperStyle,
  type TrailSettings,
} from "../../shared/domain/types/TrailTypes";

/**
 * Trail preset identifier
 */
export type TrailPresetId = "none" | "gentle" | "vivid" | "spirograph" | "loop";

/**
 * Trail preset definition
 */
export interface TrailPreset {
  id: TrailPresetId;
  name: string;
  icon: string;
  description: string;
  settings: Partial<TrailSettings>;
}

/**
 * Available trail presets
 */
export const TRAIL_PRESETS: TrailPreset[] = [
  {
    id: "none",
    name: "None",
    icon: "fa-circle-xmark",
    description: "No trail effect",
    settings: {
      enabled: false,
      mode: TrailMode.OFF,
    },
  },
  {
    id: "gentle",
    name: "Gentle",
    icon: "fa-wind",
    description: "Subtle fading trail",
    settings: {
      enabled: true,
      mode: TrailMode.FADE,
      fadeStyle: FadeStyle.LINEAR,
      taperStyle: TaperStyle.NONE,
      fadeDurationMs: 1500,
      lineWidth: 2.5,
      maxOpacity: 0.7,
      minOpacity: 0.1,
      glowEnabled: false,
    },
  },
  {
    id: "vivid",
    name: "Vivid",
    icon: "fa-magic-wand-sparkles",
    description: "Bold glowing trail",
    settings: {
      enabled: true,
      mode: TrailMode.FADE,
      fadeStyle: FadeStyle.EXPONENTIAL,
      taperStyle: TaperStyle.NONE,
      fadeDurationMs: 2500,
      lineWidth: 4,
      maxOpacity: 0.95,
      minOpacity: 0.1,
      glowEnabled: true,
      glowBlur: 4,
    },
  },
  {
    id: "spirograph",
    name: "Spirograph",
    icon: "fa-infinity",
    description: "Persistent geometric patterns",
    settings: {
      enabled: true,
      mode: TrailMode.PERSISTENT,
      lineWidth: 2,
      maxOpacity: 0.8,
      minOpacity: 0.6,
      glowEnabled: true,
      glowBlur: 3,
    },
  },
  {
    id: "loop",
    name: "Loop",
    icon: "fa-repeat",
    description: "Clears on each loop",
    settings: {
      enabled: true,
      mode: TrailMode.LOOP_CLEAR,
      lineWidth: 3,
      maxOpacity: 0.85,
      minOpacity: 0.15,
      glowEnabled: false,
    },
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: TrailPresetId): TrailPreset | undefined {
  return TRAIL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Tolerance values for fuzzy matching preset detection
 */
const TOLERANCE = {
  fadeDuration: 200, // ms
  lineWidth: 0.5,
  opacity: 0.1,
};

/**
 * Detect which preset matches the current trail settings (if any).
 * Uses fuzzy matching with tolerances for float comparisons.
 *
 * @returns The matching preset, or null if settings are custom
 */
export function detectActivePreset(trail: TrailSettings): TrailPreset | null {
  // Quick check for disabled trails
  if (!trail.enabled || trail.mode === TrailMode.OFF) {
    const nonePreset = TRAIL_PRESETS.find((p) => p.id === "none");
    return nonePreset ?? null;
  }

  // Find matching preset (skip 'none' at index 0)
  for (const preset of TRAIL_PRESETS) {
    if (preset.id === "none") continue;

    const settings = preset.settings;

    // Mode must match exactly
    if (settings.mode !== trail.mode) continue;

    // Check fade duration for FADE mode presets
    if (
      settings.mode === TrailMode.FADE &&
      settings.fadeDurationMs !== undefined &&
      Math.abs(settings.fadeDurationMs - trail.fadeDurationMs) >
        TOLERANCE.fadeDuration
    ) {
      continue;
    }

    // Check line width
    if (
      settings.lineWidth !== undefined &&
      Math.abs(settings.lineWidth - trail.lineWidth) > TOLERANCE.lineWidth
    ) {
      continue;
    }

    // Check opacity
    if (
      settings.maxOpacity !== undefined &&
      Math.abs(settings.maxOpacity - trail.maxOpacity) > TOLERANCE.opacity
    ) {
      continue;
    }

    // Check glow
    if (
      settings.glowEnabled !== undefined &&
      settings.glowEnabled !== trail.glowEnabled
    ) {
      continue;
    }

    // All checks passed - this preset matches
    return preset;
  }

  // No matching preset found - settings are custom
  return null;
}

/**
 * Check if current settings have been modified from a preset
 */
export function isModifiedFromPreset(
  trail: TrailSettings,
  presetId: TrailPresetId
): boolean {
  const preset = getPresetById(presetId);
  if (!preset) return true;

  const detected = detectActivePreset(trail);
  return detected?.id !== presetId;
}

/**
 * Apply a preset's settings to trail configuration.
 * Returns a partial TrailSettings object to merge with existing settings.
 */
export function applyPreset(
  presetId: TrailPresetId
): Partial<TrailSettings> | null {
  const preset = getPresetById(presetId);
  if (!preset) return null;

  return { ...preset.settings };
}
