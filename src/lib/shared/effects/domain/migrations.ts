import type { EffectsConfig } from "./EffectsConfig";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

/**
 * Migrate an arbitrary stored EffectsConfig up to the current version.
 * Safe to call on a current-version config (returns it unchanged after
 * a structural clone).
 */
export function migrateEffectsConfig(raw: unknown): EffectsConfig {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_EFFECTS_CONFIG);
  }
  const input = raw as Partial<EffectsConfig> & { version?: number };
  const version = input.version ?? 1;

  let out: EffectsConfig = {
    ...DEFAULT_EFFECTS_CONFIG,
    ...input,
    trails: { ...DEFAULT_EFFECTS_CONFIG.trails, ...(input.trails ?? {}) },
    fire: { ...DEFAULT_EFFECTS_CONFIG.fire, ...(input.fire ?? {}) },
    led: { ...DEFAULT_EFFECTS_CONFIG.led, ...(input.led ?? {}) },
    charcoal: { ...DEFAULT_EFFECTS_CONFIG.charcoal, ...(input.charcoal ?? {}) },
    zap: { ...DEFAULT_EFFECTS_CONFIG.zap, ...(input.zap ?? {}) },
    sparkles: { ...DEFAULT_EFFECTS_CONFIG.sparkles, ...(input.sparkles ?? {}) },
    motion: { ...DEFAULT_EFFECTS_CONFIG.motion, ...(input.motion ?? {}) },
    bloom: { ...DEFAULT_EFFECTS_CONFIG.bloom, ...(input.bloom ?? {}) },
    activePresets: {
      ...DEFAULT_EFFECTS_CONFIG.activePresets,
      ...(input.activePresets ?? {}),
    },
    version: EFFECTS_CONFIG_VERSION,
  };

  if (version < 2) {
    // v1 → v2: no transformations beyond the default-merge above.
    out = { ...out, version: 2 };
  }

  return out;
}
