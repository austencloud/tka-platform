/**
 * Compatibility shim bridging AnimationVisibilityStateManager (vm) → canonical EffectsConfig.
 *
 * PHASE A ONLY. Deleted in Phase B when the 2D panels migrate to read
 * directly from canonical state.
 *
 * Read side: `snapshotConfigFromVm(vm)` produces a full EffectsConfig
 * from the current vm state. Used to seed a new EffectsConfigState when
 * a viewer component mounts.
 *
 * Live sync: `bindVmToEffectsConfig(vm, state)` registers a vm observer
 * that re-snapshots and writes back whenever any vm effect field changes.
 * Returns a disposer.
 *
 * Charcoal note: AnimationVisibilityStateManager stores charcoal as raw
 * CharcoalSparkParams (particle-level tuning) with no semantic intensity/
 * spread/glow accessors. The canonical CharcoalIntent uses 0-1 semantic
 * scalars. Until Phase B wires a proper translator, this shim always
 * returns DEFAULT_EFFECTS_CONFIG.charcoal so the 3D renderer starts from
 * a known-good state rather than undefined values.
 */

import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { EffectsConfig } from "../domain/EffectsConfig";
import type { EffectsConfigState } from "../state/effects-config-state.svelte";
import { EFFECTS_CONFIG_VERSION } from "../domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

export function snapshotConfigFromVm(vm: AnimationVisibilityStateManager): EffectsConfig {
  return {
    version: EFFECTS_CONFIG_VERSION,

    // New schema fields - vm has no concept of these; seed from defaults.
    activeEffect: DEFAULT_EFFECTS_CONFIG.activeEffect,
    effectLayerOverrides: { ...DEFAULT_EFFECTS_CONFIG.effectLayerOverrides },

    tipEffectMap: vm.getTipEffectMap() ?? DEFAULT_EFFECTS_CONFIG.tipEffectMap,

    // Trails live in animationSettings, not vm. This snapshot returns
    // the schema defaults for trails - the animation-settings shim
    // (Task 15) provides the real values at the state factory level.
    trails: { ...DEFAULT_EFFECTS_CONFIG.trails },

    fire: {
      intensity: vm.getFireIntensity(),
      colorBlend: vm.getFireColorBlend(),
      turbulence: vm.getFireTurbulence(),
      colorCurve: vm.getFireColorCurve(),
      propColors: vm.getFirePropColors(),
      customColors: null,
    },

    led: {
      brightness: vm.getLedBrightness(),
      patternId: vm.getLedPatternId(),
      patternSpeed: vm.getLedPatternSpeed(),
      primaryColor: vm.getLedPrimaryColor(),
      secondaryColor: vm.getLedSecondaryColor(),
      colorMode: vm.getLedColorMode(),
    },

    // The vm stores charcoal as raw CharcoalSparkParams (particle physics),
    // not as the 0-1 semantic scalars the canonical schema expects. Until
    // a translator is written in Phase B, fall back to schema defaults so
    // the 3D renderer has valid values.
    charcoal: { ...DEFAULT_EFFECTS_CONFIG.charcoal },

    // New effects not yet wired to vm - seed from schema defaults.
    zap: { ...DEFAULT_EFFECTS_CONFIG.zap },
    sparkles: { ...DEFAULT_EFFECTS_CONFIG.sparkles },
    echo: { ...DEFAULT_EFFECTS_CONFIG.echo },
    bloom: { ...DEFAULT_EFFECTS_CONFIG.bloom },
    water: { ...DEFAULT_EFFECTS_CONFIG.water },
    bubbles: { ...DEFAULT_EFFECTS_CONFIG.bubbles },
    petals: { ...DEFAULT_EFFECTS_CONFIG.petals },
    smoke: { ...DEFAULT_EFFECTS_CONFIG.smoke },
    ink: { ...DEFAULT_EFFECTS_CONFIG.ink },
    frost: { ...DEFAULT_EFFECTS_CONFIG.frost },
    silk: { ...DEFAULT_EFFECTS_CONFIG.silk },
    pulse: { ...DEFAULT_EFFECTS_CONFIG.pulse },

    activePresets: {
      trails: null,
      fire: null,
      led: vm.getActivePresetId(),
      charcoal: null,
      zap: null,
      sparkles: null,
      echo: null,
      bloom: null,
      water: null,
      bubbles: null,
      petals: null,
      smoke: null,
      ink: null,
      frost: null,
      silk: null,
      pulse: null,
    },
  };
}

export function bindVmToEffectsConfig(
  vm: AnimationVisibilityStateManager,
  state: EffectsConfigState,
): () => void {
  const onChange = () => {
    const snap = snapshotConfigFromVm(vm);
    // Merge only VM-owned fields into the existing config. New effects
    // (sparkles, echo, bloom, etc.) are managed directly by the
    // EffectsConfigState and must NOT be overwritten with defaults.
    const cur = state.config;
    state.replace({
      ...cur,
      tipEffectMap: snap.tipEffectMap,
      trails: snap.trails,
      fire: snap.fire,
      led: snap.led,
      charcoal: snap.charcoal,
      activePresets: {
        ...cur.activePresets,
        trails: snap.activePresets.trails,
        fire: snap.activePresets.fire,
        led: snap.activePresets.led,
        charcoal: snap.activePresets.charcoal,
      },
    });
  };
  vm.registerObserver(onChange);
  return () => vm.unregisterObserver(onChange);
}
