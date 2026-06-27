import type { EffectsConfig } from "./effects-config";
import { EFFECTS_CONFIG_VERSION } from "./effects-config";

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  version: EFFECTS_CONFIG_VERSION,

  // Trails on as the global default - new users see motion paths.
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
    brightness: 0.5,
    colorBlend: 0,
    turbulence: 0.5,
    colorCurve: null,
    propColors: null,
    customColors: null,
  },

  led: {
    brightness: 3,
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
    frequency: 1,
    mode: "arc",
    branching: 0.35,
    style: "plasma",
    wobbleRate: 0.18,
    wobbleAmount: 0.5,
    glow: 0.5,
    jitter: 0.5,
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
    glow: 0.6,
    depth: 0.5,
    flash: 0.5,
  },

  bloom: {
    intensity: 0.5,
    radius: 36,
    color: "#f472b6",
    palette: ["#f472b6", "#fbbf24", "#22d3ee"],
    colorMode: "rainbow",
    falloff: "smooth",
    pulse: 0,
    pulseRate: 1,
    streak: 0.4,
    spikes: 0.65,
    chromatic: 0.35,
    afterglow: 0.5,
  },

  water: {
    ambientEmission: 0.4,
    motionEmission: 0.6,
    intensity: 0.6,
    palette: "classic",
    customColor: "#3a7fd9",
    clarity: 0.7,
    surfaceTension: 0.3,
    trackingMode: "both_ends",
    spewStyle: "flow",
  },

  bubbles: {
    ambientEmission: 0.3,
    motionEmission: 0.5,
    intensity: 0.6,
    palette: "soap",
    customColor: "#c8e0ff",
    sizeJitter: 0.4,
    buoyancy: 0.5,
    trackingMode: "both_ends",
  },

  petals: {
    // Motion-dominant: ambient is a whisper, motion drives the stream so
    // petals appear where the prop IS and trail its arc (ribbon, not cloud).
    ambientEmission: 0.22,
    motionEmission: 0.8,
    intensity: 0.5,
    palette: "blossom",
    customColor: "#ffb0c8",
    swayAmplitude: 0.6,
    carry: 0.72,
    streakLength: 0.6,
    fallSpeed: 0.4,
    trackingMode: "both_ends",
  },

  // Default smoke maps to the "classic" preset (incense palette). Palette
  // carries behavioral DNA - lifetime/curl/rise biases live there, not on
  // the intent. See docs/superpowers/specs/2026-04-15-effects-phase-1i-smoke-design.md
  smoke: {
    ambientEmission: 0.5,
    motionEmission: 0.4,
    intensity: 0.5,
    palette: "incense",
    customColor: "#e0e0e0",
    curlStrength: 0.5,
    riseSpeed: 0.5,
    trackingMode: "both_ends",
  },

  // Default ink maps to the "classic" preset (india palette). Motion-dominant
  // stroke medium - slow tip = thick loaded brush, fast tip = thin lifted
  // brush. Sprint 1 (1j.i) ships the stroke MVP; viscosity + splatterIntensity
  // live in the shape now but are sprint-2 knobs (strand breakup + splatter
  // bursts). See docs/superpowers/specs/2026-04-15-effects-phase-1j-ink-design.md
  ink: {
    ambientEmission: 0.2,
    motionEmission: 0.8,
    intensity: 0.6,
    palette: "watercolor",
    customColor: "#0a0a0a",
    viscosity: 0.3,
    splatterIntensity: 0.3,
    trackingMode: "both_ends",
  },

  frost: {
    ambientEmission: 0.4,
    motionEmission: 0.5,
    intensity: 0.6,
    palette: "glacial",
    customColor: "#a0d8ff",
    crystallinity: 1.0,
    spreadRate: 0.5,
    trackingMode: "both_ends",
  },

  silk: {
    intensity: 0.7,
    width: 0.5,
    duration: 0.5,
    flutter: 0.3,
    tautness: 0.5,
    palette: "satin",
    customColor: "#c0c0d0",
    trackingMode: "both_ends",
    // Serpent form — default off so existing silk stays the velocity ribbon.
    form: "ribbon",
    creature: "snake",
    bodyLength: 0.5,
    slither: 0.5,
  },

  pulse: {
    intensity: 0.7,
    reach: 0.6,
    lifetime: 1.0,
    trigger: "beat",
    style: "glow",
    beatInterval: 1,
    velocityThreshold: 0.3,
    thickness: 0.3,
    palette: "sonar",
    customColor: "#38bdf8",
    colorMode: "solid",
    color: "#38bdf8",
    colorPalette: ["#38bdf8", "#a855f7", "#22d3ee", "#f472b6", "#fbbf24"],
    trackingMode: "both_ends",
    velocityScale: 0.5,
    asymmetry: 0.45,
    chromatic: 0.3,
    flash: 0.5,
    harmonics: 0.3,
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
    water: null,
    bubbles: null,
    petals: null,
    smoke: null,
    ink: null,
    frost: null,
    silk: null,
    pulse: null,
  },

  activeEffect: "none",
  effectLayerOverrides: {},
};
