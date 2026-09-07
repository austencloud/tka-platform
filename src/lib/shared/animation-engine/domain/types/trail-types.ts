/**
 * Trail Types
 *
 * Type definitions for the spirograph-style trail effect
 * that traces prop endpoints during animation.
 *
 * SIMPLIFIED (2026-01-28):
 * - Removed TrailStyle enum (only SMOOTH_LINE was ever used)
 * - Removed FadeStyle enum (only EXPONENTIAL was ever used, now hardcoded)
 * - Removed TaperStyle enum (only TAPERED was ever used, now hardcoded)
 * - Removed NEON from TrailEffect (never implemented)
 * - Removed style, fadeStyle, taperStyle, glowEnabled from TrailSettings
 */

/**
 * Single point in the trail path
 */
import { normalizeLegacyHandPair } from "@tka/tka-types";

export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  propIndex: 0 | 1; // 0 = blue, 1 = red
  tipIndex: number; // Index into prop's tip points array (from PropTipPoints)
}

/**
 * Trail rendering mode
 */
export enum TrailMode {
  OFF = "off",
  FADE = "fade",
  LOOP_CLEAR = "loop_clear", // Clears when animation loops back to start
  PERSISTENT = "persistent", // Never clears - keeps drawing forever
}

/**
 * Which prop end(s) to track
 *
 * @deprecated Legacy endpoint-based tracking. Kept for backward compatibility
 * with TrailSettings. New code should use per-tip effect assignments via
 * TipEffectMap. When no TipEffectMap has trail assignments, these values
 * are used as fallback: LEFT_END → tip 0, RIGHT_END → last tip,
 * BOTH_ENDS → all tips.
 */
export enum TrackingMode {
  LEFT_END = "left_end", // Track only left end
  RIGHT_END = "right_end", // Track only right end (tip)
  BOTH_ENDS = "both_ends", // Track both ends
  HAND = "hand", // Track the hand path (prop center) instead of the tips
}

/**
 * Trail visual effect type
 */
export enum TrailEffect {
  NONE = "none", // No glow effect
  GLOW = "glow", // Simple shadowBlur glow
}

/**
 * Trail settings configuration
 *
 * Note: Rendering always uses:
 * - SMOOTH_LINE style (spline curves)
 * - EXPONENTIAL fade (holds brightness longer, then drops sharply)
 * - TAPERED width (thick at head, thin at tail)
 */
export interface TrailSettings {
  mode: TrailMode;
  effect: TrailEffect; // Visual effect (none, glow)
  fadeDurationMs: number; // How long before trail fades (fade mode only)
  maxPoints: number; // Maximum trail points to store
  lineWidth: number;
  glowBlur: number;
  leftColor: string;
  rightColor: string;
  /** Colors for additional tunnel layers (index 0 = layer 1, up to 2 entries for layers 1-3) */
  additionalLayerColors: Array<{ left: string; right: string }>;
  minOpacity: number; // Minimum opacity for oldest points
  maxOpacity: number; // Maximum opacity for newest points
  trackingMode: TrackingMode; // Which end(s) to track
  hideProps: boolean; // Hide props and show only trails
  usePathCache: boolean; // Use pre-computed animation paths for gap-free rendering
  previewMode: boolean; // Show future path (training mode) vs past trail (normal mode)
  /**
   * Visible trail length in captured ring points. Higher values let the user
   * see more of the path at once (up to the full mandala). The ring buffer
   * is sized to hold `tailLength + headroom` so motion can continue feeding
   * while the tail is still visible. Default matches the original hard-coded
   * LEADING_EDGE constant.
   */
  tailLength: number;
}

/** Restores trail color pairs written before physical hand identity was canonical. */
export function normalizeLegacyTrailSettings<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };
  normalized.leftColor ??= source.blueColor;
  normalized.rightColor ??= source.redColor;
  delete normalized.blueColor;
  delete normalized.redColor;
  if (Array.isArray(source.additionalLayerColors)) {
    normalized.additionalLayerColors = source.additionalLayerColors.map(
      normalizeLegacyHandPair
    );
  }
  return normalized as T;
}

import { getMotionColor } from "../../../utils/svg-color-utils";
import { HandSide } from "../../../pictograph/shared/domain/enums/pictograph-enums";

/**
 * Default trail settings - Hardcoded "Vivid" style
 *
 * These are THE trail settings. No presets, no customization.
 * Users can toggle trails on/off, but when ON, these exact settings are used.
 */
/** Canonical factory width shared by legacy settings and unified effects. */
export const DEFAULT_TRAIL_LINE_WIDTH = 4;
/** Canonical halo radius; enough separation without turning the path into a band. */
export const DEFAULT_TRAIL_GLOW_BLUR = 2.5;

export const DEFAULT_TRAIL_SETTINGS: TrailSettings = {
  mode: TrailMode.FADE,
  effect: TrailEffect.GLOW,
  fadeDurationMs: 2500,
  maxPoints: 1000,
  lineWidth: DEFAULT_TRAIL_LINE_WIDTH,
  glowBlur: DEFAULT_TRAIL_GLOW_BLUR,
  leftColor: getMotionColor(HandSide.LEFT, "dark"),
  rightColor: getMotionColor(HandSide.RIGHT, "dark"),
  additionalLayerColors: [
    { left: "#8b5cf6", right: "#f97316" }, // purple/orange - TUNNEL_LAYER_COLORS[1]
    { left: "#10b981", right: "#ec4899" }, // emerald/pink - TUNNEL_LAYER_COLORS[2]
    { left: "#06b6d4", right: "#eab308" }, // cyan/yellow - TUNNEL_LAYER_COLORS[3]
  ],
  minOpacity: 0.25,
  maxOpacity: 1.0,
  trackingMode: TrackingMode.BOTH_ENDS,
  hideProps: false,
  usePathCache: true,
  previewMode: false,
  tailLength: 20,
};

/** Hard bounds on `TrailSettings.tailLength`. */
export const TAIL_LENGTH_MIN = 10;
export const TAIL_LENGTH_MAX = 400;

/**
 * LocalStorage key for trail settings
 */
export const TRAIL_SETTINGS_STORAGE_KEY = "tka_trail_settings";
