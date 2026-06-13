import type { EffectPreset, EffectPresetGroup } from "./types";

export const ZAP_PRESETS: EffectPreset<"zap">[] = [
  {
    id: "zap-thunder",
    name: "Thunder",
    previewColor: "#88ccff",
    patch: {
      intensity: 0.9, leftColor: "#88ccff", rightColor: "#88ccff",
      frequency: 8, mode: "arc", branching: 0.4,
    },
  },
  {
    id: "zap-tesla",
    name: "Tesla",
    previewColor: "#a855f7",
    patch: {
      intensity: 1.0, leftColor: "#a855f7", rightColor: "#a855f7",
      frequency: 20, mode: "arc", branching: 0.6,
    },
  },
  {
    id: "zap-plasma",
    name: "Plasma",
    previewColor: "#ec4899",
    patch: {
      intensity: 0.7, leftColor: "#ec4899", rightColor: "#22d3ee",
      frequency: 16, mode: "crackle", branching: 0.2,
    },
  },
  {
    // "Custom" just opens the Customize panel - empty patch, marks the chip active.
    id: "zap-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
  },
];

export const ZAP_PRESET_GROUP: EffectPresetGroup = {
  effectType: "zap",
  presets: ZAP_PRESETS,
  getSummary: (state) => {
    const z = state.zap;
    return `${z.mode} · freq ${z.frequency}/s · ${Math.round(z.intensity * 100)}%`;
  },
};
