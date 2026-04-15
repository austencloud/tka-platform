import type { EffectsConfig } from "./EffectsConfig";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  version: EFFECTS_CONFIG_VERSION,

  // Trails on as the global default — new users see motion paths.
  tipEffectMap: { "*": { effect: "trails" } },

  trails: {
    trackingMode: "both_ends",
    thickness: 5,
    brightness: 1.0,
    blueColor: "#3D44B8",
    redColor: "#DC2626",
    rainbow: false,
  },

  fire: {
    intensity: 0.7,
    colorBlend: 0.5,
    turbulence: 0.5,
    colorCurve: null,
    propColors: null,
    customColors: null,
  },

  led: {
    brightness: 5,
    patternId: "solid",
    patternSpeed: 1.0,
    primaryColor: "#00ff88",
    secondaryColor: "#ffffff",
    colorMode: "unified",
  },

  charcoal: {
    intensity: 0.5,
    spread: 0.5,
    glow: 0.6,
  },

  zap: {
    intensity: 0.7,
    color: "#88ccff",
    frequency: 12,
    mode: "arc",
    branching: 0.3,
  },

  sparkles: {
    rate: 0.5,
    size: 0.5,
    lifetime: 1.2,
    color: "#fbbf24",
    rainbow: false,
  },

  motion: {
    blur: 0.4,
    speedLines: 0.5,
    threshold: 0.2,
  },

  bloom: {
    intensity: 0.6,
    threshold: 0.7,
    radius: 0.5,
  },

  activePresets: {
    trails: null,
    fire: null,
    led: null,
    charcoal: null,
    zap: null,
    sparkles: null,
    motion: null,
    bloom: null,
  },
};
