/**
 * Canonical effects config state (Svelte 5 runes).
 *
 * This is the factory - consumers create an instance per context
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
import { getSceneUndoManager } from "$lib/shared/3d/undo/getSceneUndoManager";

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
    activeEffect: patch.activeEffect ?? base.activeEffect,
    effectLayerOverrides: patch.effectLayerOverrides ?? base.effectLayerOverrides,
    tipEffectMap: patch.tipEffectMap ?? base.tipEffectMap,
    overrides: patch.overrides ?? base.overrides,
  };
}

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  const stored = loadStoredConfig();
  let config = $state<EffectsConfig>(stored ?? structuredClone(initial));
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const sceneUndo = getSceneUndoManager();

  sceneUndo.registerDomain("effects", {
    capture: () => {
      try { return structuredClone(config); }
      catch { return JSON.parse(JSON.stringify(config)); }
    },
    restore: (snapshot) => {
      try { config = structuredClone(snapshot); }
      catch { config = JSON.parse(JSON.stringify(snapshot)); }
      scheduleSave();
    },
  });

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
    sceneUndo.captureState("update-effect-config", "Update trails");
    config.trails = { ...config.trails, ...patch };
    config.activePresets.trails = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-trails");
  }

  function updateFire(patch: Partial<FireIntent>) {
    sceneUndo.captureState("update-effect-config", "Update fire");
    config.fire = { ...config.fire, ...patch };
    config.activePresets.fire = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-fire");
  }

  function updateLed(patch: Partial<LedIntent>) {
    sceneUndo.captureState("update-effect-config", "Update LED");
    config.led = { ...config.led, ...patch };
    config.activePresets.led = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-led");
  }

  function updateCharcoal(patch: Partial<CharcoalIntent>) {
    sceneUndo.captureState("update-effect-config", "Update charcoal");
    config.charcoal = { ...config.charcoal, ...patch };
    config.activePresets.charcoal = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-charcoal");
  }

  function updateZap(patch: Partial<ZapIntent>) {
    sceneUndo.captureState("update-effect-config", "Update zap");
    config.zap = { ...config.zap, ...patch };
    config.activePresets.zap = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-zap");
  }

  function updateSparkles(patch: Partial<SparklesIntent>) {
    sceneUndo.captureState("update-effect-config", "Update sparkles");
    config.sparkles = { ...config.sparkles, ...patch };
    config.activePresets.sparkles = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-sparkles");
  }

  function updateEcho(patch: Partial<EchoIntent>) {
    sceneUndo.captureState("update-effect-config", "Update echo");
    config.echo = { ...config.echo, ...patch };
    config.activePresets.echo = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-echo");
  }

  function updateBloom(patch: Partial<BloomIntent>) {
    sceneUndo.captureState("update-effect-config", "Update bloom");
    config.bloom = { ...config.bloom, ...patch };
    config.activePresets.bloom = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-bloom");
  }

  function updateWater(patch: Partial<WaterIntent>) {
    sceneUndo.captureState("update-effect-config", "Update water");
    config.water = { ...config.water, ...patch };
    config.activePresets.water = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-water");
  }

  function updateBubbles(patch: Partial<BubblesIntent>) {
    sceneUndo.captureState("update-effect-config", "Update bubbles");
    config.bubbles = { ...config.bubbles, ...patch };
    config.activePresets.bubbles = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-bubbles");
  }

  function updatePetals(patch: Partial<PetalsIntent>) {
    sceneUndo.captureState("update-effect-config", "Update petals");
    config.petals = { ...config.petals, ...patch };
    config.activePresets.petals = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-petals");
  }

  function updateSmoke(patch: Partial<SmokeIntent>) {
    sceneUndo.captureState("update-effect-config", "Update smoke");
    config.smoke = { ...config.smoke, ...patch };
    config.activePresets.smoke = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-smoke");
  }

  function updateInk(patch: Partial<InkIntent>) {
    sceneUndo.captureState("update-effect-config", "Update ink");
    config.ink = { ...config.ink, ...patch };
    config.activePresets.ink = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-ink");
  }

  function updateFrost(patch: Partial<FrostIntent>) {
    sceneUndo.captureState("update-effect-config", "Update frost");
    config.frost = { ...config.frost, ...patch };
    config.activePresets.frost = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-frost");
  }

  function updateSilk(patch: Partial<SilkIntent>) {
    sceneUndo.captureState("update-effect-config", "Update silk");
    config.silk = { ...config.silk, ...patch };
    config.activePresets.silk = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-silk");
  }

  function updatePulse(patch: Partial<PulseIntent>) {
    sceneUndo.captureState("update-effect-config", "Update pulse");
    config.pulse = { ...config.pulse, ...patch };
    config.activePresets.pulse = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing("effects-pulse");
  }

  function setTipEffectMap(map: TipEffectMap) {
    sceneUndo.captureState("toggle-effect", "Toggle tip effects");
    config.tipEffectMap = map;
    scheduleSave();
    sceneUndo.commitState();
  }

  function applyPreset(preset: EffectsPreset) {
    sceneUndo.captureState("apply-effect-preset", `Apply ${preset.effectType} preset`);
    config = mergeConfig(config, preset.patch as Partial<EffectsConfig>);
    config.activePresets[preset.effectType] = preset.id;
    scheduleSave();
    sceneUndo.commitState();
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
