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
} from "../domain/EffectsConfig";
import type { EffectsPreset } from "../domain/EffectsPreset";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

/** Shallow-in-depth deep merge used for preset application. */
function mergeConfig(base: EffectsConfig, patch: Partial<EffectsConfig>): EffectsConfig {
  return {
    ...base,
    ...patch,
    trails: patch.trails ? { ...base.trails, ...patch.trails } : base.trails,
    fire: patch.fire ? { ...base.fire, ...patch.fire } : base.fire,
    led: patch.led ? { ...base.led, ...patch.led } : base.led,
    charcoal: patch.charcoal ? { ...base.charcoal, ...patch.charcoal } : base.charcoal,
    activePresets: patch.activePresets
      ? { ...base.activePresets, ...patch.activePresets }
      : base.activePresets,
    tipEffectMap: patch.tipEffectMap ?? base.tipEffectMap,
    overrides: patch.overrides ?? base.overrides,
  };
}

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  let config = $state<EffectsConfig>(structuredClone(initial));

  function updateTrails(patch: Partial<TrailsIntent>) {
    config.trails = { ...config.trails, ...patch };
    config.activePresets.trails = null;
  }

  function updateFire(patch: Partial<FireIntent>) {
    config.fire = { ...config.fire, ...patch };
    config.activePresets.fire = null;
  }

  function updateLed(patch: Partial<LedIntent>) {
    config.led = { ...config.led, ...patch };
    config.activePresets.led = null;
  }

  function updateCharcoal(patch: Partial<CharcoalIntent>) {
    config.charcoal = { ...config.charcoal, ...patch };
    config.activePresets.charcoal = null;
  }

  function setTipEffectMap(map: TipEffectMap) {
    config.tipEffectMap = map;
  }

  function applyPreset(preset: EffectsPreset) {
    config = mergeConfig(config, preset.patch as Partial<EffectsConfig>);
    config.activePresets[preset.effectType] = preset.id;
  }

  function updateOverride<K extends keyof EffectsOverrides>(
    key: K,
    patch: NonNullable<EffectsOverrides[K]>,
  ) {
    const next: EffectsOverrides = { ...(config.overrides ?? {}) };
    next[key] = { ...(next[key] ?? {}), ...patch };
    config.overrides = next;
  }

  function replace(next: EffectsConfig) {
    config = structuredClone(next);
  }

  return {
    get config() { return config; },
    get tipEffectMap() { return config.tipEffectMap; },
    get trails() { return config.trails; },
    get fire() { return config.fire; },
    get led() { return config.led; },
    get charcoal() { return config.charcoal; },
    get overrides() { return config.overrides; },
    get activePresets() { return config.activePresets; },

    updateTrails,
    updateFire,
    updateLed,
    updateCharcoal,
    setTipEffectMap,
    applyPreset,
    updateOverride,
    replace,
  };
}

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;
