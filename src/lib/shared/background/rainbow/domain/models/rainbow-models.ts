import type { PridePalette } from "../constants/rainbow-constants";

/**
 * Rainbow wave band - horizontal color stripe with wave animation
 */
export interface RainbowBand {
  /** Base Y position (normalized 0-1) */
  baseY: number;

  /** Current wave phase for animation */
  wavePhase: number;

  /** Individual wave speed variation */
  waveSpeed: number;

  /** Wave amplitude multiplier */
  amplitude: number;

  /** Band color (hex) */
  color: string;

  /** Original bright color (for shimmer effects) */
  brightColor: string;

  /** Band opacity */
  opacity: number;

  /** Band height as fraction of screen */
  height: number;
}

/**
 * Bokeh orb - soft circular light effect
 */
export interface BokehOrb {
  /** X position (normalized 0-1) */
  x: number;

  /** Y position (normalized 0-1) */
  y: number;

  /** Orb size in pixels */
  size: number;

  /** Orb color (hex) */
  color: string;

  /** Current opacity (0-1) */
  opacity: number;

  /** Depth layer for parallax (0.5-1.5) */
  depth: number;

  /** Horizontal drift velocity */
  dx: number;

  /** Vertical drift velocity */
  dy: number;

  /** Pulse phase for opacity animation */
  pulsePhase: number;

  /** Pulse speed */
  pulseSpeed: number;
}

/**
 * Sparkle particle - small twinkling star
 */
export interface Sparkle {
  /** X position (normalized 0-1) */
  x: number;

  /** Y position (normalized 0-1) */
  y: number;

  /** Sparkle size in pixels */
  size: number;

  /** Current opacity (0-1) */
  opacity: number;

  /** Twinkle phase */
  twinklePhase: number;

  /** Twinkle speed */
  twinkleSpeed: number;

  /** Optional color tint (hex), defaults to white */
  tint?: string;
}

/**
 * Pride heart - floating heart shape
 */
export interface PrideHeart {
  /** X position (normalized 0-1) */
  x: number;

  /** Y position (normalized 0-1) */
  y: number;

  /** Heart size in pixels */
  size: number;

  /** Heart color (hex) */
  color: string;

  /** Current opacity (0-1) */
  opacity: number;

  /** Rotation angle in radians */
  rotation: number;

  /** Vertical float velocity */
  floatSpeed: number;

  /** Horizontal sway phase */
  swayPhase: number;

  /** Sway speed */
  swaySpeed: number;
}

/**
 * Shimmer point - light ripple effect
 */
export interface ShimmerPoint {
  /** X position (normalized 0-1) */
  x: number;

  /** Y position (normalized 0-1) */
  y: number;

  /** Shimmer intensity (0-1) */
  intensity: number;

  /** Phase offset for wave propagation */
  phase: number;

  /** Size of shimmer effect */
  size: number;
}

/**
 * Layer visibility toggles for Rainbow background
 */
export interface RainbowLayers {
  /** Base dark gradient */
  gradient: boolean;

  /** Flowing rainbow bands */
  bands: boolean;

  /** Light shimmer effects */
  shimmer: boolean;

  /** Soft bokeh orbs */
  bokeh: boolean;

  /** Twinkling sparkles */
  sparkles: boolean;

  /** Pride hearts (high quality only) */
  hearts: boolean;
}

/**
 * Rainbow background state
 */
export interface RainbowState {
  /** Currently selected pride palette */
  palette: PridePalette;

  /** Darkened colors for current palette */
  colors: string[];

  /** Bright colors for current palette (for effects) */
  brightColors: string[];

  /** Wave bands */
  bands: RainbowBand[];

  /** Bokeh orbs */
  bokeh: BokehOrb[];

  /** Sparkle particles */
  sparkles: Sparkle[];

  /** Pride hearts */
  hearts: PrideHeart[];

  /** Shimmer points */
  shimmerPoints: ShimmerPoint[];

  /** Global animation time */
  animationTime: number;

  /** Layer visibility */
  layers: RainbowLayers;
}

/**
 * Rainbow background statistics (for lab display)
 */
export interface RainbowStats {
  bands: number;
  bokeh: number;
  sparkles: number;
  hearts: number;
  shimmerPoints: number;
  palette: PridePalette;
}
