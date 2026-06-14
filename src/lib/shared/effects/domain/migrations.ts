import type { EffectsConfig } from "./effects-config";
import { EFFECTS_CONFIG_VERSION } from "./effects-config";
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
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy migration shapes have arbitrary keys
  type LegacyRecord = Record<string, any>;
  const input = raw as Partial<EffectsConfig> & {
    version?: number;
    zap?: LegacyRecord;
    sparkles?: LegacyRecord;
    motion?: LegacyRecord;
    echo?: LegacyRecord;
    bloom?: LegacyRecord;
    water?: LegacyRecord;
    bubbles?: LegacyRecord;
    petals?: LegacyRecord;
    smoke?: LegacyRecord;
    ink?: LegacyRecord;
    frost?: LegacyRecord;
    silk?: LegacyRecord;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = input.sparkles as Record<string, any>;
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
  // NOTE: v6 discards this motion block entirely - echo replaces it.
  if (version < 5 && input.motion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = input.motion as Record<string, any>;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = (input.tipEffectMap as any)[key] as Record<string, any> | undefined;
        if (entry?.effect === "motion") entry.effect = "echo";
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (input.activePresets && "motion" in (input.activePresets as any)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const presets = input.activePresets as Record<string, any>;
      presets.echo = presets.motion;
      delete presets.motion;
    }
  }

  // v6 → v7: Bloom pivots from fullscreen-post-process stub
  // {intensity, threshold, radius(0-1)} into a per-tip radial-halo intent with
  // color, palette, colorMode, falloff, pulse, pulseRate. Preserve existing
  // intensity. Drop threshold (no longer meaningful). Map old radius (0-1
  // normalized) to the new pixel scale via old*200+8 clamped to [8, 200]. Seed
  // new fields from defaults. tipEffectMap entries pointing at "bloom" stay
  // valid.
  if (version < 7) {
    if (input.bloom) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = input.bloom as Record<string, any>;
      const oldRadius = typeof b.radius === "number" ? b.radius : 0.5;
      const newRadiusPx = Math.min(200, Math.max(8, oldRadius * 200 + 8));
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

  // v7 → v8: add water intent. No field migration - absent water resolves to
  // DEFAULT_EFFECTS_CONFIG.water via the merge below.

  // v8 → v9: add bubbles intent + activePresets.bubbles. Net-new 10th effect
  // (11th chip including "none"). No field migration - absent bubbles resolves
  // to DEFAULT_EFFECTS_CONFIG.bubbles via the merge below. tipEffectMap entries
  // are unchanged (only the domain expands).

  // v9 → v10: add petals intent + activePresets.petals. Net-new 11th effect
  // (12th chip including "none"). No field migration - absent petals resolves
  // to DEFAULT_EFFECTS_CONFIG.petals via the merge below. tipEffectMap entries
  // are unchanged (only the domain expands).

  // v10 → v11: add smoke intent + activePresets.smoke. Net-new 12th effect
  // (13th chip including "none"). No field migration - absent smoke resolves
  // to DEFAULT_EFFECTS_CONFIG.smoke via the merge below. tipEffectMap entries
  // are unchanged (only the domain expands). First effect where palette
  // carries behavioral multipliers (lifetime, curl bias, rise bias) in
  // addition to color.

  // v11 → v12: add ink intent + activePresets.ink. Net-new 13th effect
  // (14th chip including "none"). No field migration - absent ink resolves
  // to DEFAULT_EFFECTS_CONFIG.ink via the merge below. tipEffectMap entries
  // are unchanged (only the domain expands). First stroke-based effect -
  // opaque flat-shaded pigment, variable width from velocity (slow =
  // thick loaded brush, fast = thin lifted brush). Sprint 1 = stroke MVP;
  // sprint 2 adds sag, strand breakup, splatter bursts, ground pooling.

  // v12 → v13: add frost intent + activePresets.frost. Net-new 14th effect
  // (15th chip including "none"). No field migration - absent frost resolves
  // to DEFAULT_EFFECTS_CONFIG.frost via the merge below.

  // v13 → v14: add silk intent + activePresets.silk. Net-new 15th effect
  // (16th chip including "none"). No field migration - absent silk resolves
  // to DEFAULT_EFFECTS_CONFIG.silk via the merge below.

  // v14 → v15: add pulse intent + activePresets.pulse. Net-new 16th effect
  // (17th chip including "none"). No field migration - absent pulse resolves
  // to DEFAULT_EFFECTS_CONFIG.pulse via the merge below.

  // v15 → v16: default LED brightness dropped 5 → 3. A persisted 5 on a
  // pre-16 config is the old default echoing back, not a user choice -
  // remap it. Users who picked 1-4 keep their setting.
  if (version < 16 && input.led && input.led.brightness === 5) {
    input.led = { ...input.led, brightness: 3 };
  }

  // v16 → v17: Bloom became lens bloom and its defaults changed - intensity
  // 0.95 → 0.6 (the old 0.95 default was overkill against the new additive
  // layers) and colorMode "solid" → "prop-matched". A persisted value equal to
  // the OLD default is that default echoing back, not a user choice (same logic
  // as the v16 LED remap), so remap each independently. Users who picked any
  // other intensity / a non-solid mode keep their setting. The new streak/
  // spikes/chromatic/afterglow fields resolve from defaults via the merge below.
  if (version < 17 && input.bloom) {
    if (input.bloom.intensity === 0.95) input.bloom.intensity = 0.6;
    if (input.bloom.colorMode === "solid") input.bloom.colorMode = "prop-matched";
  }

  const out: EffectsConfig = {
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
    water: { ...DEFAULT_EFFECTS_CONFIG.water, ...(input.water ?? {}) },
    bubbles: { ...DEFAULT_EFFECTS_CONFIG.bubbles, ...(input.bubbles ?? {}) },
    petals: { ...DEFAULT_EFFECTS_CONFIG.petals, ...(input.petals ?? {}) },
    smoke: { ...DEFAULT_EFFECTS_CONFIG.smoke, ...(input.smoke ?? {}) },
    ink: { ...DEFAULT_EFFECTS_CONFIG.ink, ...(input.ink ?? {}) },
    frost: { ...DEFAULT_EFFECTS_CONFIG.frost, ...(input.frost ?? {}) },
    silk: { ...DEFAULT_EFFECTS_CONFIG.silk, ...(input.silk ?? {}) },
    pulse: { ...DEFAULT_EFFECTS_CONFIG.pulse, ...(input.pulse ?? {}) },
    activePresets: {
      ...DEFAULT_EFFECTS_CONFIG.activePresets,
      ...(input.activePresets ?? {}),
    },
    version: EFFECTS_CONFIG_VERSION,
  };

  return out;
}
