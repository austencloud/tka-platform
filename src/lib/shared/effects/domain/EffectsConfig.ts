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

export const EFFECTS_CONFIG_VERSION = 2;

export type EffectType =
  | "none"
  | "trails"
  | "fire"
  | "led"
  | "charcoal"
  | "zap"
  | "sparkles"
  | "motion"
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
  /** Hex string, e.g. "#88ccff". */
  color: string;
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
  /** Hex string — primary tint. Ignored when `rainbow` is true. */
  color: string;
  /** Hue-cycle override. */
  rainbow: boolean;
}

export interface MotionIntent {
  /** 0-1 — trailing blur strength. */
  blur: number;
  /** 0-1 — velocity-based streak strength. */
  speedLines: number;
  /** 0-1 — min hand speed before effect kicks in (normalized). */
  threshold: number;
}

export interface BloomIntent {
  /** 0-1 — overall glow. */
  intensity: number;
  /** 0-1 — luminance cutoff (only pixels brighter than this bloom). */
  threshold: number;
  /** 0-1 — blur spread / kernel size. */
  radius: number;
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
  motion2D?: Record<string, unknown>;
  motion3D?: Record<string, unknown>;
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
  motion: MotionIntent;
  bloom: BloomIntent;
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
    zap: string | null;
    sparkles: string | null;
    motion: string | null;
    bloom: string | null;
  };
  overrides?: EffectsOverrides;
}
