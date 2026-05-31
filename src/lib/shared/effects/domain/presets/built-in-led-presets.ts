import type { EffectsPreset } from "../effects-preset";

export const BUILT_IN_LED_PRESETS: EffectsPreset[] = [
  {
    id: "led-green-glow",
    name: "Green Glow",
    description: "Solid green at high brightness - the classic pixel poi look.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#00ff88", "#00ff88"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#00ff88",
        secondaryColor: "#00ff88",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-ice-blue",
    name: "Ice Blue",
    description: "Cool solid blue.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#4488ff", "#4488ff"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#4488ff",
        secondaryColor: "#4488ff",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-rainbow",
    name: "Rainbow",
    description: "Full hue cycle at max brightness.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#ff0000", "#00ff00"],
    patch: {
      led: {
        brightness: 5,
        patternId: "rainbow",
        patternSpeed: 1.0,
        primaryColor: "#ff0000",
        secondaryColor: "#00ff00",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-prop-colors",
    name: "Prop Colors",
    description: "Each prop's LED takes its own blue/red identity.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#3D44B8", "#DC2626"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#3D44B8",
        secondaryColor: "#DC2626",
        colorMode: "prop-matched",
      },
    },
  },
];
