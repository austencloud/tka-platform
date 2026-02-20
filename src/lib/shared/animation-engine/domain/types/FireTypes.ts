/**
 * Fire Overlay Types
 *
 * Domain types for the WebGL fire shader overlay that renders
 * procedural flames at prop endpoints (staff tips, fan edges, etc.).
 */

/**
 * Per-tip data computed each frame by FireTipTracker.
 * Positions are in canvas pixel coordinates.
 */
export interface PropTipData {
  /** X position in canvas pixels */
  x: number;
  /** Y position in canvas pixels */
  y: number;
  /** Horizontal velocity (pixels/second) */
  velocityX: number;
  /** Vertical velocity (pixels/second) */
  velocityY: number;
  /** Speed magnitude (pixels/second) */
  speed: number;
  /** 0 = blue prop, 1 = red prop */
  propIndex: 0 | 1;
  /** 0 = left end, 1 = right end (tip) */
  endType: 0 | 1;
}

/**
 * Full frame input passed to the fire renderer each RAF tick.
 */
export interface FireFrameInput {
  /** Active tip positions + velocities (up to 4 tips) */
  tips: PropTipData[];
  /** Current time from performance.now() */
  currentTime: number;
  /** Canvas dimensions in viewbox coordinates (e.g. 950x950) */
  canvasWidth: number;
  canvasHeight: number;
  /** Whether dark mode is active (affects intensity) */
  darkMode: boolean;
}

/**
 * User-configurable fire overlay settings.
 */
export interface FireOverlayConfig {
  /** Whether fire effect is enabled */
  enabled: boolean;
  /** Fire intensity multiplier (0.1 - 3.0, default 1.0) */
  intensity: number;
  /** Flame height multiplier (0.3 - 3.0, default 1.0) */
  flameHeight: number;
  /** Whether fire reacts to spin velocity */
  velocityReactive: boolean;
  /** FBM octaves for noise quality (2 = low, 3 = medium, 4 = high) */
  quality: number;
}

/** Default fire overlay config */
export const DEFAULT_FIRE_CONFIG: FireOverlayConfig = {
  enabled: false,
  intensity: 1.0,
  flameHeight: 1.0,
  velocityReactive: true,
  quality: 4,
};
