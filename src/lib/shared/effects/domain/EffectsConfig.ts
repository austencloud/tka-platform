/**
 * Canonical effect parameter schema.
 *
 * Owned by neither 2D nor 3D — both backends translate from it via
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

export const EFFECTS_CONFIG_VERSION = 7;

export type EffectType =
  | "none"
  | "trails"
  | "fire"
  | "led"
  | "charcoal"
  | "zap"
  | "sparkles"
  | "echo"
  | "bloom";

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
}

export interface ZapIntent {
  /** 0-1 — overall arc brightness + branch count. */
  intensity: number;
  /** Hex string — color for the blue (left) hand's zap output. */
  leftColor: string;
  /** Hex string — color for the red (right) hand's zap output. */
  rightColor: string;
  /** 1-30 strikes per second. */
  frequency: number;
  /** 'arc' = tip-to-tip arc. 'crackle' = radiate from each tip. */
  mode: "arc" | "crackle";
  /** 0-1 — probability each arc segment spawns a branch. */
  branching: number;
}

export interface SparklesIntent {
  /** 0-1 — particle spawn rate multiplier. */
  rate: number;
  /** 0-1 — particle scale multiplier. */
  size: number;
  /** 0.1-3.0 seconds. */
  lifetime: number;
  /** Hex string — primary tint when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex). Used when colorMode === "palette". */
  palette: string[];
  /** "solid" = use color, "rainbow" = HSL cycle, "palette" = pick random from palette. */
  colorMode: "solid" | "rainbow" | "palette";
  /** 0-30 px — radius around the tip particles spawn within. */
  spread: number;
  /** 0-1 — 0 = floaty (low gravity), 1 = fast fall (high gravity). */
  gravity: number;
  /** 'burst' = sudden bloom on motion, 'stream' = continuous, 'trail' = follows tip path. */
  mode: "burst" | "stream" | "trail";
}

export interface EchoIntent {
  /** 0-1 — phantom peak alpha. */
  intensity: number;
  /** 1-8 — how many beats a phantom persists before fully fading. */
  decay: number;
  /** Capture interval in beats. 1 = every beat, 0.5 = every half-beat, 2 = every other beat. */
  interval: number;
  /** "staff" = line connecting blue/red tip pair; "tips" = dots at each tip; "both" = line + dots. */
  shape: "staff" | "tips" | "both";
  /** "solid" = use color, "rainbow" = hue shifts per-beat, "prop-matched" = blue tips blue / red tips red, "gradient" = hue shifts per-phantom-age. */
  colorMode: "solid" | "rainbow" | "prop-matched" | "gradient";
  /** Hex — when colorMode === "solid". */
  color: string;
  /** 1-8 — stroke width / tip dot size in 2D. */
  thickness: number;
}

export interface BloomIntent {
  /** 0-1 — peak alpha at halo center. */
  intensity: number;
  /** 8-80 px — halo radius in 2D. 3D billboard scales proportionally. */
  radius: number;
  /** Hex — used when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex) — used when colorMode === "palette". */
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
  /** 0-1 — breathing amplitude (0 = static halo, 1 = full on/off pulse). */
  pulse: number;
  /** 0.25-4 Hz — pulse frequency. */
  pulseRate: number;
}

/**
 * Backend-specific override storage. Populated only when the user
 * has explicitly edited a backend-only parameter via an Advanced
 * panel (Phase D). Intentionally untyped here — concrete shapes
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
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
    zap: string | null;
    sparkles: string | null;
    echo: string | null;
    bloom: string | null;
  };
  overrides?: EffectsOverrides;
}
