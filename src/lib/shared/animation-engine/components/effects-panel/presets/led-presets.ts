/**
 * LED effect presets.
 *
 * 4 quick-select presets for the LED overlay. Each preset sets a pattern,
 * brightness, color, and color mode. "Prop Colors" uses the prop-matched
 * color mode so each prop gets its canonical color (blue/red).
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { LedIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyLed(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<LedIntent>,
): void {
  state.updateEffect("led", patch);
  // updateLed nulls activePresets.led; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "led",
    patch: { activePresets: { ...state.activePresets, led: presetId } },
  } as unknown as EffectsPreset);
}

export const LED_PRESETS: EffectPreset[] = [
  {
    id: "led-green-glow",
    name: "Green Glow",
    previewColor: "#00ff88",
    apply: (state) => applyLed(state, "led-green-glow", {
      colorMode: "unified",
      primaryColor: "#00ff88",
      patternId: "solid",
      brightness: 4,
    }),
  },
  {
    id: "led-ice-blue",
    name: "Ice Blue",
    previewColor: "#4488ff",
    apply: (state) => applyLed(state, "led-ice-blue", {
      colorMode: "unified",
      primaryColor: "#4488ff",
      patternId: "solid",
      brightness: 4,
    }),
  },
  {
    id: "led-rainbow",
    name: "Rainbow",
    previewColor: "rainbow",
    apply: (state) => applyLed(state, "led-rainbow", {
      colorMode: "unified",
      patternId: "rainbow",
      brightness: 5,
    }),
  },
  {
    id: "led-prop-colors",
    name: "Prop Colors",
    previewColor: "#4488ff",
    previewColor2: "#ff4444",
    apply: (state) => applyLed(state, "led-prop-colors", {
      colorMode: "prop-matched",
      patternId: "solid",
      brightness: 4,
    }),
  },
];

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const LED_PRESET_GROUP: EffectPresetGroup = {
  effectType: "led",
  presets: LED_PRESETS,
  getSummary: (state): string => {
    const pattern = capitalizeFirst(state.led.patternId);
    const brightness = state.led.brightness;
    const speed = state.led.patternSpeed.toFixed(1);
    return `${pattern} · Brightness ${brightness} · ${speed}x`;
  },
};
