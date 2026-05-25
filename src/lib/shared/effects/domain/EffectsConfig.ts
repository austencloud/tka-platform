/**
 * Canonical effect parameter schema.
 *
 * Owned by neither 2D nor 3D - both backends translate from it via
 * pure functions in src/lib/shared/effects/translators/.
 *
 * The intent layer describes what the user meant (fire intensity,
 * trail brightness, LED color) independent of any backend. Per-backend
 * overrides live in the optional `overrides` field and let 2D/3D
 * grow independently where their physics genuinely diverge.
 */

import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import type {
  FireColorCurve,
  PropFlameColor,
} from "$lib/shared/animation-engine/domain/types/FireTypes";

export const EFFECTS_CONFIG_VERSION = 15;

export type EffectType =
  | "none"
  | "trails"
  | "fire"
  | "led"
  | "charcoal"
  | "zap"
  | "sparkles"
  | "echo"
  | "bloom"
  | "water"
  | "bubbles"
  | "petals"
  | "smoke"
  | "ink"
  | "frost"
  | "silk"
  | "pulse";

export interface TrailsIntent {
  /** Which staff end(s) the trail tracks. */
  trackingMode: "left_end" | "right_end" | "both_ends";
  /** Abstract thickness, 1-12. Each backend interprets in native units. */
  thickness: number;
  /** 0.3-1.0. Drives opacity in 2D, emissive + alpha in 3D. */
  brightness: number;
  /** Hex string. Ignored when `rainbow` is true. */
  blueColor: string;
  /** Hex string. Ignored when `rainbow` is true. */
  redColor: string;
  /** Hue-cycling mode. Overrides blueColor/redColor. */
  rainbow: boolean;
}

export interface FireIntent {
  /** 0.45-1.0. Overall fire strength. */
  intensity: number;
  /** 0-1. 0 = natural fire color, 1 = fully prop-colored tint. */
  colorBlend: number;
  /** 0-1. Idle flicker / chaos. */
  turbulence: number;
  /** 4-stop temperature→color gradient. Null = use default curve. */
  colorCurve: FireColorCurve | null;
  /** Per-hand flame color override. Null = default blue/red. */
  propColors: [PropFlameColor, PropFlameColor] | null;
  /** Hex pair for the "Custom" preset. Null = preset not in custom mode. */
  customColors: { left: string; right: string } | null;
}

export interface LedIntent {
  /** 1-5 discrete. */
  brightness: number;
  /** Pattern registry id. */
  patternId: string;
  /** 0.1-5.0. Pattern animation rate multiplier. */
  patternSpeed: number;
  /** Hex string. */
  primaryColor: string;
  /** Hex string. */
  secondaryColor: string;
  /** How colors map to the two props. */
  colorMode: "unified" | "per-hand" | "prop-matched";
}

export interface CharcoalIntent {
  /** 0-1. Semantic intensity (RGB params derived on demand). */
  intensity: number;
  /** 0-1. Semantic spread. */
  spread: number;
  /** 0-1. Semantic glow. */
  glow: number;
  /** Optional hottest spark color override (RGB 0-255). Null = use default curve. */
  coreColor?: [number, number, number];
  /** Optional mid-temperature spark color override (RGB 0-255). */
  midColor?: [number, number, number];
  /** Optional coolest spark color override (RGB 0-255). */
  coolColor?: [number, number, number];
}

export interface ZapIntent {
  /** 0-1 - overall arc brightness + branch count. */
  intensity: number;
  /** Hex string - color for the blue (left) hand's zap output. */
  leftColor: string;
  /** Hex string - color for the red (right) hand's zap output. */
  rightColor: string;
  /** 1-30 strikes per second. */
  frequency: number;
  /** 'arc' = tip-to-tip arc. 'crackle' = radiate from each tip. */
  mode: "arc" | "crackle";
  /** 0-1 - probability each arc segment spawns a branch. */
  branching: number;
}

export interface SparklesIntent {
  /** 0-1 - particle spawn rate multiplier. */
  rate: number;
  /** 0-1 - particle scale multiplier. */
  size: number;
  /** 0.1-3.0 seconds. */
  lifetime: number;
  /** Hex string - primary tint when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex). Used when colorMode === "palette". */
  palette: string[];
  /** "solid" = use color, "rainbow" = HSL cycle, "palette" = pick random from palette. */
  colorMode: "solid" | "rainbow" | "palette";
  /** 0-30 px - radius around the tip particles spawn within. */
  spread: number;
  /** 0-1 - 0 = floaty (low gravity), 1 = fast fall (high gravity). */
  gravity: number;
  /** 'burst' = sudden bloom on motion, 'stream' = continuous, 'trail' = follows tip path. */
  mode: "burst" | "stream" | "trail";
}

export interface EchoIntent {
  /** 0-1 - phantom peak alpha. */
  intensity: number;
  /** 1-8 - how many beats a phantom persists before fully fading. */
  decay: number;
  /** Capture interval in beats. 1 = every beat, 0.5 = every half-beat, 2 = every other beat. */
  interval: number;
  /** "staff" = line connecting blue/red tip pair; "tips" = dots at each tip; "both" = line + dots. */
  shape: "staff" | "tips" | "both";
  /** "solid" = use color, "rainbow" = hue shifts per-beat, "prop-matched" = blue tips blue / red tips red, "gradient" = hue shifts per-phantom-age. */
  colorMode: "solid" | "rainbow" | "prop-matched" | "gradient";
  /** Hex - when colorMode === "solid". */
  color: string;
  /** 1-8 - stroke width / tip dot size in 2D. */
  thickness: number;
}

export interface BloomIntent {
  /** 0-1 - peak alpha at halo center. */
  intensity: number;
  /** 8-200 px - halo radius in 2D. 3D billboard scales proportionally. */
  radius: number;
  /** Hex - used when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex) - used when colorMode === "palette". */
  palette: string[];
  /**
   * "solid" = use color.
   * "prop-matched" = blue tips blue, red tips red (from trail colors).
   * "rainbow" = hue cycles with time (full cycle / 6s).
   * "palette" = pick from palette by tipIndex.
   */
  colorMode: "solid" | "prop-matched" | "rainbow" | "palette";
  /** "smooth" = gaussian falloff, "sharp" = tighter hot core, "ring" = hollow corona. */
  falloff: "smooth" | "sharp" | "ring";
  /** 0-1 - breathing amplitude (0 = static halo, 1 = full on/off pulse). */
  pulse: number;
  /** 0.25-4 Hz - pulse frequency. */
  pulseRate: number;
}

export interface WaterIntent {
  /** 0-1. Continuous drip rate when props are at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive emission multiplier. */
  motionEmission: number;
  /** 0-1. Overall droplet scale + brightness. */
  intensity: number;
  /** Named color palette. "custom" uses customColor instead. */
  palette: "classic" | "mercury" | "acid" | "blood" | "spirit" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. 0 = milky/opaque, 1 = crystal clear. Drives 3D refraction + 2D highlight. */
  clarity: number;
  /** 0-1. How strongly surface tension holds droplets round under motion.
   *  1 = very round (tight tension), 0 = stretches hard under velocity. */
  surfaceTension: number;
  /** Which staff end(s) droplets track. */
  trackingMode: "left_end" | "right_end" | "both_ends";
  /** How the water comes off the prop.
   *  - splash: heavier discrete chunks on motion, drippy at rest
   *  - flow:   streamy long elongated droplets that trail the tip
   *  - mist:   fine high-count spray, drops stay round, wide spread */
  spewStyle: "splash" | "flow" | "mist";
}

export interface BubblesIntent {
  /** 0-1. Continuous emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive multiplier. Spin rate drives this via tip speed. */
  motionEmission: number;
  /** 0-1. Overall size + brightness. */
  intensity: number;
  /** Named palette. "custom" uses customColor instead. */
  palette: "soap" | "champagne" | "oil" | "acid" | "spirit" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Size variance per bubble. 0 = uniform, 1 = wide mix. */
  sizeJitter: number;
  /** 0-1. Upward rise speed scalar. */
  buoyancy: number;
  /** Which staff end(s) bubbles track. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface PetalsIntent {
  /** 0-1. Continuous emission. 2D: from tip. 3D: from above scene ceiling. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive burst from tip (both backends). */
  motionEmission: number;
  /** 0-1. Overall petal size + brightness. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "blossom" | "autumn" | "jungle" | "ash" | "gold" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Sinusoidal sway amplitude. 0 = straight fall, 1 = wide flutter. */
  swayAmplitude: number;
  /** 0-1. Downward velocity scalar. */
  fallSpeed: number;
  /** Which staff end(s) petals track. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface InkIntent {
  /**
   * 0-1. Ambient drip rate at rest. Hard-capped at 0.3 in the renderer -
   * ink is motion-dominant. User can still dial up but even at max it
   * stays subtle. This is ink, not rain.
   */
  ambientEmission: number;
  /** 0-1. Velocity-reactive stroke emission. The star of the effect. */
  motionEmission: number;
  /** 0-1. Stroke width + opacity. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "india" | "sumi" | "watercolor" | "neon" | "blood" | "acid" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /**
   * 0-1. How easily strands break into droplets under stretch.
   * 0 = continuous ribbon, 1 = shatters into drops. Shipped in the shape
   * now; sprint 2 (1j.ii) wires it through the renderer.
   */
  viscosity: number;
  /**
   * 0-1. Splatter burst intensity on velocity spikes.
   * 0 = clean strokes, 1 = Jackson Pollock. Shipped in the shape now;
   * sprint 2 (1j.iii) wires it through the renderer.
   */
  splatterIntensity: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface SmokeIntent {
  /** 0-1. Continuous emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive multiplier. Spin rate drives this via tip speed. */
  motionEmission: number;
  /** 0-1. Overall puff size + opacity. */
  intensity: number;
  /**
   * Named palette. Personality-laden - palette carries behavioral DNA
   * (lifetime, curl bias, rise bias) alongside color. "custom" uses
   * customColor with neutral behavior defaults.
   */
  palette: "incense" | "fog" | "genie" | "cursed" | "spirit" | "campfire" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Curl noise magnitude. 0 = straight rise, 1 = chaotic swirl. Multiplied by palette.curlBias. */
  curlStrength: number;
  /** 0-1. Upward rise speed scalar. Multiplied by palette.riseBias. */
  riseSpeed: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface FrostIntent {
  /** 0-1. Continuous cold emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive crystal/particle emission. */
  motionEmission: number;
  /** 0-1. Crystal size + frost density. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "glacial" | "breath" | "black_ice" | "aurora" | "diamond" | "cursed" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Crystal angular complexity. 0 = simple hexagons, 1 = branching dendrites. */
  crystallinity: number;
  /** 0-1. How quickly frost spreads along the trail path. 0 = stays near tip, 1 = rapid coverage. */
  spreadRate: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface SilkIntent {
  /** 0-1. Overall opacity + width multiplier. */
  intensity: number;
  /** 0-1. Base ribbon half-width before velocity scaling. Maps to 5-30px. */
  width: number;
  /** 0-1. Sample lifetime. Maps to 0.5-4.0 seconds. */
  duration: number;
  /** 0-1. Sine-wave edge displacement amplitude. 0 = smooth, 1 = chaotic flutter. */
  flutter: number;
  /** 0-1. How much velocity narrows the ribbon. 0 = constant width, 1 = dramatic speed contrast. */
  tautness: number;
  /** Named palette. "custom" uses customColor. */
  palette: "satin" | "velvet" | "ethereal" | "shadow" | "gold_leaf" | "ember" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** Which staff end(s) the ribbon tracks. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

export interface PulseIntent {
  /** 0-1. Ring peak alpha + brightness. */
  intensity: number;
  /** 0-1. Max ring expansion radius. Maps to 20-200px. */
  reach: number;
  /** 0.2-3.0 seconds. Ring lifetime from birth to full fade. */
  lifetime: number;
  /** "beat" = on beat onsets, "velocity" = on acceleration threshold, "continuous" = steady emission amplified by beats. */
  trigger: "beat" | "velocity" | "continuous";
  /** "stroke" = thin expanding outlines, "glow" = gradient-filled halos with bright leading edge. */
  style: "stroke" | "glow";
  /** 1-8. Beat interval for beat trigger. */
  beatInterval: number;
  /** 0-1. Velocity threshold for velocity trigger. */
  velocityThreshold: number;
  /** 0-1. Ring stroke width or gradient band thickness. */
  thickness: number;
  /** Named palette. "custom" uses customColor. */
  palette: "sonar" | "ripple" | "aurora" | "neon" | "ember" | "void" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** Color selection mode. */
  colorMode: "solid" | "prop-matched" | "rainbow" | "palette";
  /** Hex - when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex) - when colorMode === "palette". */
  colorPalette: string[];
  /** Which staff end(s) emit rings. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}

/**
 * Backend-specific override storage. Populated only when the user
 * has explicitly edited a backend-only parameter via an Advanced
 * panel (Phase D). Intentionally untyped here - concrete shapes
 * live with the translators.
 */
export interface EffectsOverrides {
  trails2D?: Record<string, unknown>;
  trails3D?: Record<string, unknown>;
  fire2D?: Record<string, unknown>;
  fire3D?: Record<string, unknown>;
  led2D?: Record<string, unknown>;
  led3D?: Record<string, unknown>;
  charcoal2D?: Record<string, unknown>;
  charcoal3D?: Record<string, unknown>;
  zap2D?: Record<string, unknown>;
  zap3D?: Record<string, unknown>;
  sparkles2D?: Record<string, unknown>;
  sparkles3D?: Record<string, unknown>;
  echo2D?: Record<string, unknown>;
  echo3D?: Record<string, unknown>;
  bloom2D?: Record<string, unknown>;
  bloom3D?: Record<string, unknown>;
  water2D?: Record<string, unknown>;
  water3D?: Record<string, unknown>;
  bubbles2D?: Record<string, unknown>;
  bubbles3D?: Record<string, unknown>;
  petals2D?: Record<string, unknown>;
  petals3D?: Record<string, unknown>;
  smoke2D?: Record<string, unknown>;
  smoke3D?: Record<string, unknown>;
  ink2D?: Record<string, unknown>;
  ink3D?: Record<string, unknown>;
  frost2D?: Record<string, unknown>;
  frost3D?: Record<string, unknown>;
  silk2D?: Record<string, unknown>;
  silk3D?: Record<string, unknown>;
  pulse2D?: Record<string, unknown>;
  pulse3D?: Record<string, unknown>;
}

export interface EffectsConfig {
  version: number;
  tipEffectMap: TipEffectMap;
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
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
    zap: string | null;
    sparkles: string | null;
    echo: string | null;
    bloom: string | null;
    water: string | null;
    bubbles: string | null;
    petals: string | null;
    smoke: string | null;
    ink: string | null;
    frost: string | null;
    silk: string | null;
    pulse: string | null;
  };
  /** Which effect is currently active. "none" = no effect selected. */
  activeEffect: EffectType;
  /** Per-effect render-layer override. Missing key = default ("behind"). */
  effectLayerOverrides: Record<string, "behind" | "front">;
  overrides?: EffectsOverrides;
}
