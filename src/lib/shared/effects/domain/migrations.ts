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
  const input = raw as Partial<EffectsConfig> & { version?: number; zap?: any; sparkles?: any; motion?: any };
  const version = input.version ?? 1;

  // v2 → v3: split zap.color into zap.leftColor + zap.rightColor.
  // Mutate the input shape *before* the default-merge so downstream sees v3 shape.
  if (version < 3 && input.zap && typeof input.zap.color === "string" && !input.zap.leftColor) {
    input.zap.leftColor = input.zap.color;
    input.zap.rightColor = input.zap.color;
    delete input.zap.color;
  }

  // v3 → v4: collapse sparkles.rainbow boolean into colorMode enum and add
  // palette/spread/gravity/mode with sensible defaults. Mutate in place before
  // the default-merge so existing persisted configs upgrade without losing
  // user selections.
  if (version < 4 && input.sparkles) {
    const s = input.sparkles as any;
    s.palette ??= ["#fbbf24", "#f59e0b", "#fde047"];
    s.colorMode ??= s.rainbow ? "rainbow" : "solid";
    s.spread ??= 8;
    s.gravity ??= 0.3;
    s.mode ??= "stream";
    delete s.rainbow;
  }

  // v4 → v5: extend motion with color/colorMode/length/count. Existing
  // persisted v4 configs only have blur/speedLines/threshold; inject
  // defaults so the upgraded shape matches the new MotionIntent.
  if (version < 5 && input.motion) {
    const m = input.motion as any;
    m.color ??= "#ffffff";
    m.colorMode ??= "solid";
    m.length ??= 0.5;
    m.count ??= 6;
  }

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

  return out;
}
