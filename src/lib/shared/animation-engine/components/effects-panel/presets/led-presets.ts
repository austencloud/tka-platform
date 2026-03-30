/**
 * LED effect presets.
 *
 * 4 quick-select presets for the LED overlay. Each preset sets a pattern,
 * brightness, color, and color mode. "Prop Colors" uses the prop-matched
 * color mode so each prop gets its canonical color (blue/red).
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";

export const LED_PRESETS: EffectPreset[] = [
  {
    id: "led-green-glow",
    name: "Green Glow",
    previewColor: "#00ff88",
    apply: (vm) => {
      vm.setLedColorMode("unified");
      vm.setLedPrimaryColor("#00ff88");
      vm.setLedPatternId("solid");
      vm.setLedBrightness(4);
      vm.setActivePreset("led-green-glow");
    },
  },
  {
    id: "led-ice-blue",
    name: "Ice Blue",
    previewColor: "#4488ff",
    apply: (vm) => {
      vm.setLedColorMode("unified");
      vm.setLedPrimaryColor("#4488ff");
      vm.setLedPatternId("solid");
      vm.setLedBrightness(4);
      vm.setActivePreset("led-ice-blue");
    },
  },
  {
    id: "led-rainbow",
    name: "Rainbow",
    previewColor: "rainbow",
    apply: (vm) => {
      vm.setLedColorMode("unified");
      vm.setLedPatternId("rainbow");
      vm.setLedBrightness(5);
      vm.setActivePreset("led-rainbow");
    },
  },
  {
    id: "led-prop-colors",
    name: "Prop Colors",
    previewColor: "#4488ff",
    previewColor2: "#ff4444",
    apply: (vm) => {
      vm.setLedColorMode("prop-matched");
      vm.setLedPatternId("solid");
      vm.setLedBrightness(4);
      vm.setActivePreset("led-prop-colors");
    },
  },
];

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const LED_PRESET_GROUP: EffectPresetGroup = {
  effectType: "led",
  presets: LED_PRESETS,
  getSummary: (vm: AnimationVisibilityStateManager): string => {
    const pattern = capitalizeFirst(vm.getLedPatternId());
    const brightness = vm.getLedBrightness();
    const speed = vm.getLedPatternSpeed().toFixed(1);
    return `${pattern} · Brightness ${brightness} · ${speed}x`;
  },
};
