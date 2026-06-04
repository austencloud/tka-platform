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
} from "../domain/effects-config";

export interface EffectConfigMap {
  trails: TrailsIntent;
  fire: FireIntent;
  led: LedIntent;
  charcoal: CharcoalIntent;
  zap: ZapIntent;
  sparkles: SparklesIntent;
  echo: EchoIntent;
  bloom: BloomIntent;
  water: WaterIntent;
  bubbles: BubblesIntent;
  petals: PetalsIntent;
  smoke: SmokeIntent;
  ink: InkIntent;
  frost: FrostIntent;
  silk: SilkIntent;
  pulse: PulseIntent;
}
import type { EffectsPreset } from "../domain/effects-preset";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";
import { migrateEffectsConfig } from "../domain/migrations";
import { getSceneUndoManager } from "$lib/shared/3d/undo/get-scene-undo-manager";
import { charcoalParamsToSemantic } from "$lib/shared/animation-engine/domain/types/charcoal-spark-types";

const STORAGE_KEY = "tka_effects_config";
const VM_STORAGE_KEY = "animation-visibility-settings";

const EFFECT_IDS = [
  "trails", "fire", "led", "charcoal", "zap", "sparkles", "echo", "bloom",
  "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse",
] as const;

/**
 * Legacy effect keys the VM overlay consumes. Stripped from the VM entry
 * after migration — the visibility manager re-serializes unknown keys
 * (`{...defaults, ...parsed}` then full-object save), so without stripping
 * these never age out and the overlay re-imposes stale values on EVERY
 * load, silently clobbering the user's effects-config changes.
 */
const LEGACY_VM_EFFECT_KEYS = [
  "fireIntensity", "fireColorBlend", "fireTurbulence", "fireColorCurve", "firePropColors",
  "ledBrightness", "ledPatternId", "ledPatternSpeed", "ledPrimaryColor", "ledSecondaryColor",
  "ledColorMode", "ledActivePresetId", "ledUserPresets",
  "charcoalParams", "tipEffectMap", "effectLayerOverrides",
] as const;

/**
 * One-time migration from the old VM localStorage key.
 * If the user has non-default fire/LED/charcoal/tipEffectMap/effectLayerOverrides
 * persisted under the VM key but missing from the new EffectsConfig key, snapshot
 * them into the config once, then strip the consumed keys from the VM entry
 * so this genuinely runs once.
 */
function migrateFromVmStorageOnce(config: EffectsConfig): EffectsConfig {
  if (typeof window === "undefined") return config;
  try {
    const vmRaw = localStorage.getItem(VM_STORAGE_KEY);
    if (!vmRaw) return config;
    const vm = JSON.parse(vmRaw);
    const migrated = { ...config };

    // Fire
    if (vm.fireIntensity !== undefined) {
      migrated.fire = {
        ...migrated.fire,
        intensity: vm.fireIntensity ?? migrated.fire.intensity,
        colorBlend: vm.fireColorBlend ?? migrated.fire.colorBlend,
        turbulence: vm.fireTurbulence ?? migrated.fire.turbulence,
        colorCurve: vm.fireColorCurve ?? migrated.fire.colorCurve,
        propColors: vm.firePropColors ?? migrated.fire.propColors,
      };
    }

    // LED
    if (vm.ledPatternId !== undefined) {
      migrated.led = {
        ...migrated.led,
        brightness: vm.ledBrightness ?? migrated.led.brightness,
        patternId: vm.ledPatternId ?? migrated.led.patternId,
        patternSpeed: vm.ledPatternSpeed ?? migrated.led.patternSpeed,
        primaryColor: vm.ledPrimaryColor ?? migrated.led.primaryColor,
        secondaryColor: vm.ledSecondaryColor ?? migrated.led.secondaryColor,
        colorMode: vm.ledColorMode ?? migrated.led.colorMode,
      };
    }

    // Charcoal — VM stores raw CharcoalSparkParams; convert to semantic scalars
    if (vm.charcoalParams) {
      const semantic = charcoalParamsToSemantic(vm.charcoalParams);
      migrated.charcoal = { ...migrated.charcoal, ...semantic };
    }

    // tipEffectMap
    if (vm.tipEffectMap && Object.keys(vm.tipEffectMap).length > 0) {
      migrated.tipEffectMap = vm.tipEffectMap;
    }

    // effectLayerOverrides
    if (vm.effectLayerOverrides && Object.keys(vm.effectLayerOverrides).length > 0) {
      migrated.effectLayerOverrides = vm.effectLayerOverrides;
    }

    // activeEffect — derive from tipEffectMap wildcard
    const wildcard = migrated.tipEffectMap["*"];
    if (wildcard) {
      migrated.activeEffect = wildcard.effect as typeof migrated.activeEffect;
    }

    // Strip the consumed legacy keys so the overlay can't re-impose stale
    // values on future loads. The effects-config key is canonical from here.
    let stripped = false;
    for (const key of LEGACY_VM_EFFECT_KEYS) {
      if (key in vm) {
        delete vm[key];
        stripped = true;
      }
    }
    if (stripped) {
      try {
        localStorage.setItem(VM_STORAGE_KEY, JSON.stringify(vm));
      } catch { /* quota exceeded or private browsing */ }
    }

    return migrated;
  } catch {
    return config;
  }
}

function loadStoredConfig(): EffectsConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EffectsConfig>;
    const storedVersion = typeof parsed.version === "number" ? parsed.version : 1;
    // Versioned migration chain FIRST — it needs the raw legacy field shapes
    // (e.g. v2 zap.color) before any default-merge injects current-shape
    // fields. It also merges defaults and stamps the current version.
    const migrated = migrateEffectsConfig(parsed);
    // Then the one-time legacy VM-key overlay (strips the keys it consumes).
    const withVm = migrateFromVmStorageOnce(migrated);
    // The VM key predates config versioning entirely, so a VM-supplied
    // brightness 5 is the same stale pre-v16 default — apply the v16 remap
    // to the overlaid value too.
    if (storedVersion < 16 && withVm.led.brightness === 5) {
      withVm.led = { ...withVm.led, brightness: 3 };
    }
    return withVm;
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
    activeEffect: patch.activeEffect ?? base.activeEffect,
    effectLayerOverrides: patch.effectLayerOverrides
      ? { ...base.effectLayerOverrides, ...patch.effectLayerOverrides }
      : base.effectLayerOverrides,
  };
}

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  const stored = loadStoredConfig();
  let config = $state<EffectsConfig>(stored ?? migrateFromVmStorageOnce(structuredClone(initial)));
  let version = $state(0);
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
      version++;
      scheduleSave();
    },
  });

  function scheduleSave() {
    version++;
    if (typeof window === "undefined") return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch { /* quota exceeded or private browsing */ }
    }, 300);
  }

  function updateEffect<K extends keyof EffectConfigMap>(
    effectId: K,
    patch: Partial<EffectConfigMap[K]>,
  ) {
    if (!EFFECT_IDS.includes(effectId as any)) {
      throw new Error(`Unknown effect id: "${effectId}"`);
    }
    sceneUndo.captureState("update-effect-config", `Update ${effectId}`);
    (config as any)[effectId] = { ...(config as any)[effectId], ...patch };
    config.activePresets[effectId as keyof typeof config.activePresets] = null;
    scheduleSave();
    sceneUndo.commitStateCoalescing(`effects-${effectId}`);
  }

  function setActiveEffect(effect: string) {
    sceneUndo.captureState("set-active-effect", "Set active effect");
    if (effect === "none") {
      config.activeEffect = "none" as any;
      config.tipEffectMap = {};
    } else {
      config.activeEffect = effect as any;
      config.tipEffectMap = { "*": { effect: effect as any } };
    }
    scheduleSave();
    sceneUndo.commitState();
  }

  function getEffectLayer(effectId: string): "behind" | "front" {
    return config.effectLayerOverrides[effectId] ?? "behind";
  }

  function setEffectLayer(effectId: string, mode: "behind" | "front") {
    if (mode === "behind") {
      const { [effectId]: _omit, ...rest } = config.effectLayerOverrides;
      config.effectLayerOverrides = rest;
    } else {
      config.effectLayerOverrides = {
        ...config.effectLayerOverrides,
        [effectId]: mode,
      };
    }
    scheduleSave();
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
    get activePresets() { return config.activePresets; },
    get activeEffect() { return config.activeEffect; },
    get effectLayerOverrides() { return config.effectLayerOverrides; },
    get version() { return version; },

    effect<K extends keyof EffectConfigMap>(id: K): EffectConfigMap[K] {
      return (config as unknown as Record<string, unknown>)[id] as EffectConfigMap[K];
    },

    updateEffect,
    setActiveEffect,
    getEffectLayer,
    setEffectLayer,
    setTipEffectMap,
    applyPreset,
    replace,
  };
}

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;
