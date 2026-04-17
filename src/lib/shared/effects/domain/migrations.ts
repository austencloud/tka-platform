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
  const input = raw as Partial<EffectsConfig> & {
    version?: number;
    zap?: any;
    sparkles?: any;
    motion?: any;
    echo?: any;
    bloom?: any;
  };
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
  // defaults so the upgraded shape matches the old MotionIntent.
  // NOTE: v6 discards this motion block entirely — echo replaces it.
  if (version < 5 && input.motion) {
    const m = input.motion as any;
    m.color ??= "#ffffff";
    m.colorMode ??= "solid";
    m.length ??= 0.5;
    m.count ??= 6;
  }

  // v5 → v6: Motion effect replaced by Echo (beat-onset phantoms). The old
  // motion fields (blur/speedLines/threshold/color/colorMode/length/count)
  // have no clean mapping to echo's stroboscopic phantom model, so we
  // discard them and reseed echo defaults. Tip-effect assignments that
  // named "motion" are rewritten to "echo" so existing sequences keep
  // firing a visual effect on the same tips.
  if (version < 6) {
    if (input.motion) {
      input.echo = {
        intensity: 0.7,
        decay: 4,
        interval: 1,
        shape: "staff",
        colorMode: "solid",
        color: "#ffffff",
        thickness: 3,
      };
      delete input.motion;
    }
    if (input.tipEffectMap) {
      for (const key of Object.keys(input.tipEffectMap)) {
        const entry: any = (input.tipEffectMap as any)[key];
        if (entry?.effect === "motion") entry.effect = "echo";
      }
    }
    if (input.activePresets && "motion" in (input.activePresets as any)) {
      (input.activePresets as any).echo = (input.activePresets as any).motion;
      delete (input.activePresets as any).motion;
    }
  }

  // v6 → v7: Bloom pivots from fullscreen-post-process stub
  // {intensity, threshold, radius(0-1)} into a per-tip radial-halo intent with
  // color, palette, colorMode, falloff, pulse, pulseRate. Preserve existing
  // intensity. Drop threshold (no longer meaningful). Map old radius (0-1
  // normalized) to the new pixel scale via old*72+8 clamped to [8, 80]. Seed
  // new fields from defaults. tipEffectMap entries pointing at "bloom" stay
  // valid.
  if (version < 7) {
    if (input.bloom) {
      const b = input.bloom as any;
      const oldRadius = typeof b.radius === "number" ? b.radius : 0.5;
      const newRadiusPx = Math.min(80, Math.max(8, oldRadius * 72 + 8));
      const preservedIntensity = typeof b.intensity === "number" ? b.intensity : 0.7;
      b.radius = newRadiusPx;
      b.intensity = preservedIntensity;
      delete b.threshold;
      b.color ??= "#f472b6";
      b.palette ??= ["#f472b6", "#fbbf24", "#22d3ee"];
      b.colorMode ??= "solid";
      b.falloff ??= "smooth";
      b.pulse ??= 0;
      b.pulseRate ??= 1;
    }
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
    echo: { ...DEFAULT_EFFECTS_CONFIG.echo, ...(input.echo ?? {}) },
    bloom: { ...DEFAULT_EFFECTS_CONFIG.bloom, ...(input.bloom ?? {}) },
    activePresets: {
      ...DEFAULT_EFFECTS_CONFIG.activePresets,
      ...(input.activePresets ?? {}),
    },
    version: EFFECTS_CONFIG_VERSION,
  };

  return out;
}
