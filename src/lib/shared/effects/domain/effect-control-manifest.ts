/**
 * Shared per-effect control manifest.
 *
 * Single source of truth for what tuning controls each effect exposes. Both the
 * 2D customize panels and the 3D viewer FX popover render from this via
 * EffectControlStack, so editing a control here changes both surfaces — "fix 2D
 * → fixes 3D" by construction.
 *
 * Every effect has a uniform Primary row (Color/Palette · Intensity · two
 * character knobs, 3–5 controls) so effects feel equally simple to control;
 * deeper params live under tier "advanced". `tracking` is the standard
 * left/both/right segmented control for tip-emission effects.
 *
 * Spec: docs/superpowers/specs/2026-06-21-effect-control-consolidation-design.md
 */

import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";

export type ControlType =
  | "slider"
  | "toggle"
  | "chip"
  | "segmented"
  | "color"
  | "colorPair"
  | "palette"
  | "paletteSwatches"
  | "ledPattern";
export type ControlTier = "primary" | "tracking" | "advanced";

export interface ControlDescriptor {
  id: string;
  label: string;
  type: ControlType;
  /** Intent field on the effect's config object (the key passed to updateEffect). */
  field: string;
  tier: ControlTier;
  // slider
  min?: number;
  max?: number;
  step?: number;
  pct?: boolean;
  // segmented / select
  options?: { value: string; label: string }[];
  // colorPair: the two fields (e.g. blueColor/redColor)
  pairFields?: [string, string];
  // palette: named options (swatch optional, cosmetic)
  paletteOptions?: { value: string; label: string; swatch?: string }[];
  // chip: a boolean rendered as a toggle chip with a preview swatch
  swatch?: "rainbow";
  // conditional visibility (e.g. tint only when palette === "custom")
  showWhen?: (intent: Record<string, unknown>) => boolean;
}

const TRACK_OPTS = [
  { value: "left_end", label: "Left" },
  { value: "both_ends", label: "Both" },
  { value: "right_end", label: "Right" },
];

const isCustomPalette = (i: Record<string, unknown>) => i.palette === "custom";
const isSerpent = (i: Record<string, unknown>) => i.form === "serpent";

/** Build a palette descriptor + its conditional custom-tint, the shared shape
 *  every named-palette effect uses for its Primary "Color". */
function paletteColor(
  effect: string,
  values: { value: string; label: string }[],
): ControlDescriptor[] {
  return [
    { id: `${effect}-palette`, label: "Color", type: "palette", field: "palette", tier: "primary", paletteOptions: values },
    { id: `${effect}-tint`, label: "Tint", type: "color", field: "customColor", tier: "primary", showWhen: isCustomPalette },
  ];
}

const slider = (
  effect: string,
  field: string,
  label: string,
  opts: Partial<ControlDescriptor> & { tier: ControlTier },
): ControlDescriptor => ({
  id: `${effect}-${field}`,
  label,
  type: "slider",
  field,
  min: 0,
  max: 1,
  step: 0.05,
  pct: true,
  ...opts,
});

export const EFFECT_CONTROLS: Record<EffectId, ControlDescriptor[]> = {
  trails: [
    { id: "trails-color", label: "Color", type: "colorPair", field: "blueColor", pairFields: ["blueColor", "redColor"], tier: "primary" },
    { id: "trails-rainbow", label: "Rainbow", type: "chip", field: "rainbow", tier: "primary", swatch: "rainbow" },
    slider("trails", "brightness", "Brightness", { min: 0.3, max: 1, tier: "primary" }),
    slider("trails", "thickness", "Thickness", { min: 1, max: 12, step: 1, pct: false, tier: "primary" }),
    { id: "trails-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
  ],
  fire: [
    slider("fire", "colorBlend", "Color", { tier: "primary" }),
    slider("fire", "intensity", "Intensity", { min: 0.45, max: 1, tier: "primary" }),
    slider("fire", "brightness", "Brightness", { tier: "primary" }),
    slider("fire", "turbulence", "Turbulence", { tier: "primary" }),
  ],
  led: [
    { id: "led-color", label: "Color", type: "color", field: "primaryColor", tier: "primary" },
    slider("led", "brightness", "Brightness", { min: 1, max: 5, step: 1, pct: false, tier: "primary" }),
    { id: "led-pattern", label: "Pattern", type: "ledPattern", field: "patternId", tier: "primary" },
    slider("led", "patternSpeed", "Speed", { min: 0.1, max: 5, step: 0.1, pct: false, tier: "primary" }),
    { id: "led-colormode", label: "Mode", type: "segmented", field: "colorMode", tier: "advanced", options: [
      { value: "unified", label: "Unified" }, { value: "per-hand", label: "Per-hand" }, { value: "prop-matched", label: "Prop" },
    ] },
  ],
  charcoal: [
    slider("charcoal", "intensity", "Intensity", { tier: "primary" }),
    slider("charcoal", "spread", "Spread", { tier: "primary" }),
    slider("charcoal", "glow", "Glow", { tier: "primary" }),
  ],
  zap: [
    { id: "zap-color", label: "Color", type: "colorPair", field: "leftColor", pairFields: ["leftColor", "rightColor"], tier: "primary" },
    slider("zap", "intensity", "Intensity", { tier: "primary" }),
    { id: "zap-style", label: "Style", type: "segmented", field: "style", tier: "primary", options: [
      { value: "branching", label: "Storm" }, { value: "plasma", label: "Plasma" }, { value: "web", label: "Web" },
    ] },
    slider("zap", "frequency", "Frequency", { min: 1, max: 30, step: 1, pct: false, tier: "primary" }),
    slider("zap", "branching", "Branching", { tier: "advanced", showWhen: (i) => i.style === "branching" }),
    slider("zap", "wobbleRate", "Wobble Rate", { tier: "advanced", showWhen: (i) => i.style === "plasma" }),
    slider("zap", "wobbleAmount", "Wobble Amount", { tier: "advanced", showWhen: (i) => i.style === "plasma" }),
    slider("zap", "glow", "Glow", { tier: "advanced" }),
    slider("zap", "jitter", "Jitter", { tier: "advanced" }),
  ],
  sparkles: [
    { id: "sparkles-colormode", label: "Color", type: "segmented", field: "colorMode", tier: "primary", options: [
      { value: "solid", label: "Solid" }, { value: "rainbow", label: "Rainbow" }, { value: "palette", label: "Palette" },
    ] },
    slider("sparkles", "rate", "Rate", { tier: "primary" }),
    { id: "sparkles-mode", label: "Mode", type: "segmented", field: "mode", tier: "primary", options: [
      { value: "burst", label: "Burst" }, { value: "stream", label: "Stream" }, { value: "trail", label: "Trail" },
    ] },
    slider("sparkles", "size", "Size", { tier: "primary" }),
    { id: "sparkles-tint", label: "Tint", type: "color", field: "color", tier: "advanced", showWhen: (i) => i.colorMode === "solid" },
    { id: "sparkles-palette", label: "Palette", type: "paletteSwatches", field: "palette", tier: "advanced", showWhen: (i) => i.colorMode === "palette" },
    slider("sparkles", "lifetime", "Lifetime", { min: 0.1, max: 3, step: 0.1, pct: false, tier: "advanced" }),
    slider("sparkles", "spread", "Spread", { min: 0, max: 30, step: 1, pct: false, tier: "advanced" }),
    slider("sparkles", "gravity", "Gravity", { tier: "advanced" }),
  ],
  echo: [
    { id: "echo-colormode", label: "Color", type: "segmented", field: "colorMode", tier: "primary", options: [
      { value: "solid", label: "Solid" }, { value: "rainbow", label: "Rainbow" }, { value: "prop-matched", label: "Prop" }, { value: "gradient", label: "Gradient" },
    ] },
    slider("echo", "intensity", "Intensity", { tier: "primary" }),
    { id: "echo-shape", label: "Shape", type: "segmented", field: "shape", tier: "primary", options: [
      { value: "staff", label: "Staff" }, { value: "tips", label: "Tips" }, { value: "both", label: "Both" },
    ] },
    slider("echo", "decay", "Decay", { min: 1, max: 8, step: 1, pct: false, tier: "primary" }),
    { id: "echo-tint", label: "Tint", type: "color", field: "color", tier: "advanced", showWhen: (i) => i.colorMode === "solid" },
    slider("echo", "interval", "Interval", { min: 0.25, max: 2, step: 0.25, pct: false, tier: "advanced" }),
    slider("echo", "thickness", "Thickness", { min: 1, max: 8, step: 1, pct: false, tier: "advanced" }),
    slider("echo", "glow", "Glow", { tier: "advanced" }),
    slider("echo", "depth", "Depth", { tier: "advanced" }),
    slider("echo", "flash", "Flash", { tier: "advanced" }),
    slider("echo", "streak", "Streak", { tier: "advanced" }),
  ],
  bloom: [
    { id: "bloom-colormode", label: "Color", type: "segmented", field: "colorMode", tier: "primary", options: [
      { value: "solid", label: "Solid" }, { value: "prop-matched", label: "Prop" }, { value: "rainbow", label: "Rainbow" }, { value: "palette", label: "Palette" },
    ] },
    slider("bloom", "intensity", "Intensity", { tier: "primary" }),
    slider("bloom", "radius", "Radius", { min: 8, max: 90, step: 2, pct: false, tier: "primary" }),
    { id: "bloom-falloff", label: "Falloff", type: "segmented", field: "falloff", tier: "primary", options: [
      { value: "smooth", label: "Smooth" }, { value: "sharp", label: "Sharp" }, { value: "ring", label: "Ring" },
    ] },
    { id: "bloom-tint", label: "Tint", type: "color", field: "color", tier: "advanced", showWhen: (i) => i.colorMode === "solid" },
    slider("bloom", "pulse", "Pulse", { tier: "advanced" }),
    slider("bloom", "pulseRate", "Rate", { min: 0.25, max: 4, step: 0.25, pct: false, tier: "advanced" }),
    slider("bloom", "streak", "Streak", { tier: "advanced" }),
    slider("bloom", "spikes", "Spikes", { tier: "advanced" }),
    slider("bloom", "chromatic", "Dispersion", { tier: "advanced" }),
    slider("bloom", "afterglow", "Afterglow", { tier: "advanced" }),
  ],
  water: [
    ...paletteColor("water", [
      { value: "classic", label: "Classic" }, { value: "mercury", label: "Mercury" }, { value: "acid", label: "Acid" },
      { value: "blood", label: "Blood" }, { value: "spirit", label: "Spirit" }, { value: "custom", label: "Custom" },
    ]),
    slider("water", "intensity", "Intensity", { tier: "primary" }),
    slider("water", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("water", "motionEmission", "Motion", { tier: "primary" }),
    { id: "water-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    { id: "water-style", label: "Style", type: "segmented", field: "spewStyle", tier: "advanced", options: [
      { value: "splash", label: "Splash" }, { value: "flow", label: "Flow" }, { value: "mist", label: "Mist" },
    ] },
    slider("water", "clarity", "Clarity", { tier: "advanced" }),
    slider("water", "surfaceTension", "Tension", { tier: "advanced" }),
  ],
  bubbles: [
    ...paletteColor("bubbles", [
      { value: "soap", label: "Soap" }, { value: "champagne", label: "Bubbly" }, { value: "oil", label: "Oil" },
      { value: "acid", label: "Acid" }, { value: "spirit", label: "Spirit" }, { value: "custom", label: "Custom" },
    ]),
    slider("bubbles", "intensity", "Size", { tier: "primary" }),
    slider("bubbles", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("bubbles", "motionEmission", "Motion", { tier: "primary" }),
    { id: "bubbles-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("bubbles", "sizeJitter", "Jitter", { tier: "advanced" }),
    slider("bubbles", "buoyancy", "Rise", { tier: "advanced" }),
  ],
  petals: [
    ...paletteColor("petals", [
      { value: "blossom", label: "Blossom" }, { value: "autumn", label: "Autumn" }, { value: "jungle", label: "Jungle" },
      { value: "ash", label: "Ash" }, { value: "gold", label: "Gold" }, { value: "custom", label: "Custom" },
    ]),
    slider("petals", "intensity", "Size", { tier: "primary" }),
    slider("petals", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("petals", "motionEmission", "Motion", { tier: "primary" }),
    { id: "petals-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("petals", "carry", "Carry", { tier: "advanced" }),
    slider("petals", "streakLength", "Streak", { tier: "advanced" }),
    slider("petals", "fallSpeed", "Fall", { tier: "advanced" }),
  ],
  smoke: [
    ...paletteColor("smoke", [
      { value: "incense", label: "Incense" }, { value: "fog", label: "Fog" }, { value: "genie", label: "Genie" },
      { value: "cursed", label: "Cursed" }, { value: "spirit", label: "Spirit" }, { value: "campfire", label: "Campfire" }, { value: "custom", label: "Custom" },
    ]),
    slider("smoke", "intensity", "Intensity", { tier: "primary" }),
    slider("smoke", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("smoke", "motionEmission", "Motion", { tier: "primary" }),
    { id: "smoke-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("smoke", "curlStrength", "Curl", { tier: "advanced" }),
    slider("smoke", "riseSpeed", "Rise", { tier: "advanced" }),
  ],
  ink: [
    ...paletteColor("ink", [
      { value: "india", label: "India" }, { value: "sumi", label: "Sumi" }, { value: "watercolor", label: "Water" },
      { value: "neon", label: "Neon" }, { value: "blood", label: "Blood" }, { value: "acid", label: "Acid" }, { value: "custom", label: "Custom" },
    ]),
    slider("ink", "intensity", "Intensity", { tier: "primary" }),
    slider("ink", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("ink", "motionEmission", "Motion", { tier: "primary" }),
    { id: "ink-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("ink", "viscosity", "Viscosity", { tier: "advanced" }),
    slider("ink", "splatterIntensity", "Splatter", { tier: "advanced" }),
  ],
  frost: [
    ...paletteColor("frost", [
      { value: "glacial", label: "Glacial" }, { value: "breath", label: "Breath" }, { value: "black_ice", label: "Black Ice" },
      { value: "aurora", label: "Aurora" }, { value: "diamond", label: "Diamond" }, { value: "cursed", label: "Cursed" }, { value: "custom", label: "Custom" },
    ]),
    slider("frost", "intensity", "Intensity", { tier: "primary" }),
    slider("frost", "ambientEmission", "Ambient", { tier: "primary" }),
    slider("frost", "motionEmission", "Motion", { tier: "primary" }),
    { id: "frost-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("frost", "crystallinity", "Crystals", { tier: "advanced" }),
    slider("frost", "spreadRate", "Spread", { tier: "advanced" }),
  ],
  silk: [
    ...paletteColor("silk", [
      { value: "satin", label: "Satin" }, { value: "velvet", label: "Velvet" }, { value: "ethereal", label: "Ethereal" },
      { value: "shadow", label: "Shadow" }, { value: "gold_leaf", label: "Gold" }, { value: "ember", label: "Ember" }, { value: "custom", label: "Custom" },
    ]),
    { id: "silk-form", label: "Form", type: "segmented", field: "form", tier: "primary", options: [
      { value: "ribbon", label: "Ribbon" }, { value: "serpent", label: "Serpent" },
    ] },
    { id: "silk-creature", label: "Creature", type: "segmented", field: "creature", tier: "primary", showWhen: isSerpent, options: [
      { value: "snake", label: "Snake" }, { value: "dragon", label: "Dragon" },
    ] },
    slider("silk", "intensity", "Intensity", { tier: "primary" }),
    slider("silk", "width", "Width", { tier: "primary" }),
    slider("silk", "flutter", "Flutter", { tier: "primary", showWhen: (i) => !isSerpent(i) }),
    { id: "silk-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    slider("silk", "bodyLength", "Length", { tier: "advanced", showWhen: isSerpent }),
    slider("silk", "slither", "Slither", { tier: "advanced", showWhen: isSerpent }),
    slider("silk", "duration", "Duration", { tier: "advanced", showWhen: (i) => !isSerpent(i) }),
    slider("silk", "tautness", "Tautness", { tier: "advanced", showWhen: (i) => !isSerpent(i) }),
  ],
  pulse: [
    ...paletteColor("pulse", [
      { value: "sonar", label: "Sonar" }, { value: "ripple", label: "Ripple" }, { value: "aurora", label: "Aurora" },
      { value: "neon", label: "Neon" }, { value: "ember", label: "Ember" }, { value: "void", label: "Void" }, { value: "custom", label: "Custom" },
    ]),
    slider("pulse", "intensity", "Intensity", { tier: "primary" }),
    { id: "pulse-trigger", label: "Trigger", type: "segmented", field: "trigger", tier: "primary", options: [
      { value: "beat", label: "Beat" }, { value: "velocity", label: "Velocity" }, { value: "continuous", label: "Steady" },
    ] },
    slider("pulse", "reach", "Reach", { tier: "primary" }),
    { id: "pulse-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
    { id: "pulse-style", label: "Style", type: "segmented", field: "style", tier: "advanced", options: [
      { value: "stroke", label: "Stroke" }, { value: "glow", label: "Glow" },
    ] },
    slider("pulse", "lifetime", "Lifetime", { min: 0.2, max: 3, step: 0.1, pct: false, tier: "advanced" }),
    slider("pulse", "thickness", "Thickness", { tier: "advanced" }),
    slider("pulse", "velocityScale", "Vel→Size", { tier: "advanced" }),
    slider("pulse", "asymmetry", "Asymmetry", { tier: "advanced" }),
    slider("pulse", "chromatic", "Chromatic", { tier: "advanced" }),
    slider("pulse", "flash", "Flash", { tier: "advanced" }),
    slider("pulse", "harmonics", "Harmonics", { tier: "advanced" }),
  ],
};

/** Effects that have a live 3D renderer — the only ones the 3D viewer lists. */
export const EFFECTS_WITH_3D_RENDERER: ReadonlySet<EffectId> = new Set<EffectId>([
  "trails",
  "fire",
  "led",
  "charcoal",
]);

export function primaryControls(effect: EffectId): ControlDescriptor[] {
  return EFFECT_CONTROLS[effect].filter((c) => c.tier === "primary" || c.tier === "tracking");
}
export function advancedControls(effect: EffectId): ControlDescriptor[] {
  return EFFECT_CONTROLS[effect].filter((c) => c.tier === "advanced");
}
