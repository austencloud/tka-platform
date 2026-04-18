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
    leftColor: "#88ccff",
    rightColor: "#88ccff",
    frequency: 12,
    mode: "arc",
    branching: 0.3,
  },

  sparkles: {
    rate: 0.5,
    size: 0.5,
    lifetime: 1.2,
    color: "#fbbf24",
    palette: ["#fbbf24", "#f59e0b", "#fde047"],
    colorMode: "solid",
    spread: 8,
    gravity: 0.3,
    mode: "stream",
  },

  echo: {
    intensity: 0.7,
    decay: 4,
    interval: 1,
    shape: "staff",
    colorMode: "solid",
    color: "#ffffff",
    thickness: 3,
  },

  bloom: {
    intensity: 0.95,
    radius: 90,
    color: "#f472b6",
    palette: ["#f472b6", "#fbbf24", "#22d3ee"],
    colorMode: "solid",
    falloff: "smooth",
    pulse: 0,
    pulseRate: 1,
  },

  activePresets: {
    trails: null,
    fire: null,
    led: null,
    charcoal: null,
    zap: null,
    sparkles: null,
    echo: null,
    bloom: null,
  },
};
