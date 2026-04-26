/**
 * Canonical effects config state (Svelte 5 runes).
 *
 * This is the factory — consumers create an instance per context
 * (sequence viewer, export panel, etc.) and distribute via
 * effects-config-context.ts. See the state-management rule for why
 * we use factories + context rather than module-level singletons.
 */

import type {
  EffectsConfig,
  EffectsOverrides,
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  EchoIntent,
  BloomIntent,
  WaterIntent,
  BubblesIntent,
  PetalsIntent,
  SmokeIntent,
  InkIntent,
  FrostIntent,
  SilkIntent,
  PulseIntent,
} from "../domain/EffectsConfig";
import type { EffectsPreset } from "../domain/EffectsPreset";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";
import { EFFECTS_CONFIG_VERSION } from "../domain/EffectsConfig";

const STORAGE_KEY = "tka_effects_config";

function loadStoredConfig(): EffectsConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EffectsConfig>;
    if (parsed.version !== EFFECTS_CONFIG_VERSION) {
      return mergeConfig(DEFAULT_EFFECTS_CONFIG, parsed);
    }
    return mergeConfig(DEFAULT_EFFECTS_CONFIG, parsed);
  } catch {
    return null;
  }
}

/** Shallow-in-depth deep merge used for preset application. */
function mergeConfig(base: EffectsConfig, patch: Partial<EffectsConfig>): EffectsConfig {
  return {
    ...base,
    ...patch,
    trails: patch.trails ? { ...base.trails, ...patch.trails } : base.trails,
    fire: patch.fire ? { ...base.fire, ...patch.fire } : base.fire,
    led: patch.led ? { ...base.led, ...patch.led } : base.led,
    charcoal: patch.charcoal ? { ...base.charcoal, ...patch.charcoal } : base.charcoal,
    zap: patch.zap ? { ...base.zap, ...patch.zap } : base.zap,
    sparkles: patch.sparkles ? { ...base.sparkles, ...patch.sparkles } : base.sparkles,
    echo: patch.echo ? { ...base.echo, ...patch.echo } : base.echo,
    bloom: patch.bloom ? { ...base.bloom, ...patch.bloom } : base.bloom,
    water: patch.water ? { ...base.water, ...patch.water } : base.water,
    bubbles: patch.bubbles ? { ...base.bubbles, ...patch.bubbles } : base.bubbles,
    petals: patch.petals ? { ...base.petals, ...patch.petals } : base.petals,
    smoke: patch.smoke ? { ...base.smoke, ...patch.smoke } : base.smoke,
    ink: patch.ink ? { ...base.ink, ...patch.ink } : base.ink,
    frost: patch.frost ? { ...base.frost, ...patch.frost } : base.frost,
    silk: patch.silk ? { ...base.silk, ...patch.silk } : base.silk,
    pulse: patch.pulse ? { ...base.pulse, ...patch.pulse } : base.pulse,
    activePresets: patch.activePresets
      ? { ...base.activePresets, ...patch.activePresets }
      : base.activePresets,
    tipEffectMap: patch.tipEffectMap ?? base.tipEffectMap,
    overrides: patch.overrides ?? base.overrides,
  };
}

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  const stored = loadStoredConfig();
  let config = $state<EffectsConfig>(stored ?? structuredClone(initial));
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave() {
    if (typeof window === "undefined") return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch { /* quota exceeded or private browsing */ }
    }, 300);
  }

  function updateTrails(patch: Partial<TrailsIntent>) {
    config.trails = { ...config.trails, ...patch };
    config.activePresets.trails = null;
    scheduleSave();
  }

  function updateFire(patch: Partial<FireIntent>) {
    config.fire = { ...config.fire, ...patch };
    config.activePresets.fire = null;
    scheduleSave();
  }

  function updateLed(patch: Partial<LedIntent>) {
    config.led = { ...config.led, ...patch };
    config.activePresets.led = null;
    scheduleSave();
  }

  function updateCharcoal(patch: Partial<CharcoalIntent>) {
    config.charcoal = { ...config.charcoal, ...patch };
    config.activePresets.charcoal = null;
    scheduleSave();
  }

  function updateZap(patch: Partial<ZapIntent>) {
    config.zap = { ...config.zap, ...patch };
    config.activePresets.zap = null;
    scheduleSave();
  }

  function updateSparkles(patch: Partial<SparklesIntent>) {
    config.sparkles = { ...config.sparkles, ...patch };
    config.activePresets.sparkles = null;
    scheduleSave();
  }

  function updateEcho(patch: Partial<EchoIntent>) {
    config.echo = { ...config.echo, ...patch };
    config.activePresets.echo = null;
    scheduleSave();
  }

  function updateBloom(patch: Partial<BloomIntent>) {
    config.bloom = { ...config.bloom, ...patch };
    config.activePresets.bloom = null;
    scheduleSave();
  }

  function updateWater(patch: Partial<WaterIntent>) {
    config.water = { ...config.water, ...patch };
    config.activePresets.water = null;
    scheduleSave();
  }

  function updateBubbles(patch: Partial<BubblesIntent>) {
    config.bubbles = { ...config.bubbles, ...patch };
    config.activePresets.bubbles = null;
    scheduleSave();
  }

  function updatePetals(patch: Partial<PetalsIntent>) {
    config.petals = { ...config.petals, ...patch };
    config.activePresets.petals = null;
    scheduleSave();
  }

  function updateSmoke(patch: Partial<SmokeIntent>) {
    config.smoke = { ...config.smoke, ...patch };
    config.activePresets.smoke = null;
    scheduleSave();
  }

  function updateInk(patch: Partial<InkIntent>) {
    config.ink = { ...config.ink, ...patch };
    config.activePresets.ink = null;
    scheduleSave();
  }

  function updateFrost(patch: Partial<FrostIntent>) {
    config.frost = { ...config.frost, ...patch };
    config.activePresets.frost = null;
    scheduleSave();
  }

  function updateSilk(patch: Partial<SilkIntent>) {
    config.silk = { ...config.silk, ...patch };
    config.activePresets.silk = null;
    scheduleSave();
  }

  function updatePulse(patch: Partial<PulseIntent>) {
    config.pulse = { ...config.pulse, ...patch };
    config.activePresets.pulse = null;
    scheduleSave();
  }

  function setTipEffectMap(map: TipEffectMap) {
    config.tipEffectMap = map;
    scheduleSave();
  }

  function applyPreset(preset: EffectsPreset) {
    config = mergeConfig(config, preset.patch as Partial<EffectsConfig>);
    config.activePresets[preset.effectType] = preset.id;
    scheduleSave();
  }

  function updateOverride<K extends keyof EffectsOverrides>(
    key: K,
    patch: NonNullable<EffectsOverrides[K]>,
  ) {
    const next: EffectsOverrides = { ...(config.overrides ?? {}) };
    next[key] = { ...(next[key] ?? {}), ...patch };
    config.overrides = next;
    scheduleSave();
  }

  function replace(next: EffectsConfig) {
    try {
      config = structuredClone(next);
    } catch {
      config = JSON.parse(JSON.stringify(next));
    }
    scheduleSave();
  }

  return {
    get config() { return config; },
    get tipEffectMap() { return config.tipEffectMap; },
    get trails() { return config.trails; },
    get fire() { return config.fire; },
    get led() { return config.led; },
    get charcoal() { return config.charcoal; },
    get zap() { return config.zap; },
    get sparkles() { return config.sparkles; },
    get echo() { return config.echo; },
    get bloom() { return config.bloom; },
    get water() { return config.water; },
    get bubbles() { return config.bubbles; },
    get petals() { return config.petals; },
    get smoke() { return config.smoke; },
    get ink() { return config.ink; },
    get frost() { return config.frost; },
    get silk() { return config.silk; },
    get pulse() { return config.pulse; },
    get overrides() { return config.overrides; },
    get activePresets() { return config.activePresets; },

    updateTrails,
    updateFire,
    updateLed,
    updateCharcoal,
    updateZap,
    updateSparkles,
    updateEcho,
    updateBloom,
    updateWater,
    updateBubbles,
    updatePetals,
    updateSmoke,
    updateInk,
    updateFrost,
    updateSilk,
    updatePulse,
    setTipEffectMap,
    applyPreset,
    updateOverride,
    replace,
  };
}

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;
