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
  enabled: boolean;
  mode: TrailMode;
  effect: TrailEffect; // Visual effect (none, glow)
  fadeDurationMs: number; // How long before trail fades (fade mode only)
  maxPoints: number; // Maximum trail points to store
  lineWidth: number;
  glowBlur: number;
  blueColor: string;
  redColor: string;
  /** Colors for additional tunnel layers (index 0 = layer 1, up to 2 entries for layers 1-3) */
  additionalLayerColors: Array<{ blue: string; red: string }>;
  minOpacity: number; // Minimum opacity for oldest points
  maxOpacity: number; // Maximum opacity for newest points
  trackingMode: TrackingMode; // Which end(s) to track
  hideProps: boolean; // Hide props and show only trails
  usePathCache: boolean; // Use pre-computed animation paths for gap-free rendering
  previewMode: boolean; // Show future path (training mode) vs past trail (normal mode)
}

import { getMotionColor } from "../../../utils/svg-color-utils";
import { MotionColor } from "../../../pictograph/shared/domain/enums/pictograph-enums";

/**
 * Default trail settings - Hardcoded "Vivid" style
 *
 * These are THE trail settings. No presets, no customization.
 * Users can toggle trails on/off, but when ON, these exact settings are used.
 */
export const DEFAULT_TRAIL_SETTINGS: TrailSettings = {
  enabled: true,
  mode: TrailMode.FADE,
  effect: TrailEffect.GLOW,
  fadeDurationMs: 2500,
  maxPoints: 1000,
  lineWidth: 5,
  glowBlur: 3,
  blueColor: getMotionColor(MotionColor.BLUE, "dark"),
  redColor: getMotionColor(MotionColor.RED, "dark"),
  additionalLayerColors: [
    { blue: "#8b5cf6", red: "#f97316" }, // purple/orange - TUNNEL_LAYER_COLORS[1]
    { blue: "#10b981", red: "#ec4899" }, // emerald/pink - TUNNEL_LAYER_COLORS[2]
    { blue: "#06b6d4", red: "#eab308" }, // cyan/yellow - TUNNEL_LAYER_COLORS[3]
  ],
  minOpacity: 0.25,
  maxOpacity: 1.0,
  trackingMode: TrackingMode.RIGHT_END,
  hideProps: false,
  usePathCache: true,
  previewMode: false,
};

/**
 * LocalStorage key for trail settings
 */
export const TRAIL_SETTINGS_STORAGE_KEY = "tka_trail_settings";
