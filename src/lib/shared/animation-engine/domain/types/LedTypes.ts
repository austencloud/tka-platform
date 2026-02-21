/**
 * LED Overlay Types
 *
 * Domain types for the WebGL LED overlay that renders addressable
 * LED prop visuals using additive glow sprites, PBR bloom, and
 * persistence-of-vision trail accumulation.
 */

/**
 * A single addressable LED point in prop-local space.
 * Offsets are relative to the prop's primary axis; the renderer
 * transforms them into viewbox coordinates each frame.
 */
export interface LedPoint {
  /** Prop-local offset along the primary (long) axis */
  dx: number;
  /** Prop-local offset perpendicular to the primary axis */
  dy: number;
  /** Maximum output brightness for this LED, normalized to [0, 1] */
  brightness: number;
}

/**
 * Full LED layout for one prop type.
 * Each entry in `points` maps to one addressable LED.
 */
export interface PropLedConfig {
  /** Ordered list of LED positions in prop-local space */
  points: LedPoint[];
}

/**
 * Per-tip data computed each frame by the LED tip tracker.
 * Positions are in viewbox coordinates (e.g. 950x950).
 * Velocity and color are provided by the pattern engine.
 */
export interface LedTipData {
  /** X position in viewbox coordinates */
  x: number;
  /** Y position in viewbox coordinates */
  y: number;
  /** Horizontal velocity (viewbox units/second) */
  velocityX: number;
  /** Vertical velocity (viewbox units/second) */
  velocityY: number;
  /** Speed magnitude (viewbox units/second) */
  speed: number;
  /** 0 = blue prop, 1 = red prop */
  propIndex: 0 | 1;
  /** Index of this LED within the prop's LED point array */
  tipIndex: number;
  /** Max output brightness from the LedPoint config, normalized to [0, 1] */
  brightness: number;
  /** Red channel from the pattern engine, normalized to [0, 1] */
  r: number;
  /** Green channel from the pattern engine, normalized to [0, 1] */
  g: number;
  /** Blue channel from the pattern engine, normalized to [0, 1] */
  b: number;
}

/**
 * Full frame input passed to the LED renderer each RAF tick.
 */
export interface LedFrameInput {
  /** Active LED tip positions, velocities, and colors (one entry per LED per prop) */
  tips: LedTipData[];
  /** Current time from performance.now() */
  currentTime: number;
  /** Canvas width in viewbox coordinates (e.g. 950) */
  canvasWidth: number;
  /** Canvas height in viewbox coordinates (e.g. 950) */
  canvasHeight: number;
}

/**
 * User-configurable LED overlay settings.
 * Controls glow appearance, bloom post-processing, POV trail persistence,
 * and the color pattern applied across the LED array.
 */
export interface LedOverlayConfig {
  /** Whether the LED overlay effect is enabled */
  enabled: boolean;
  /**
   * Glow sprite radius multiplier (0.5 - 3.0, default 1.0).
   * Higher values produce wider, softer halos around each LED.
   */
  glowRadius: number;
  /**
   * Bloom post-process intensity (0.0 - 0.15, default 0.04).
   * Controls how much bright areas bleed into surrounding pixels.
   */
  bloomIntensity: number;
  /**
   * Trail accumulation fade rate per frame (0.80 - 0.98, default 0.92).
   * Higher values retain more history, producing longer persistence-of-vision trails.
   */
  trailFadeRate: number;
  /** Identifier for the color pattern engine to apply across the LED array */
  patternId: string;
  /**
   * Pattern animation speed multiplier (0.1 - 5.0, default 1.0).
   * Scales how quickly the pattern cycles or evolves over time.
   */
  patternSpeed: number;
  /** Primary color for the pattern engine, expressed as a CSS hex string (e.g. "#00ff88") */
  primaryColor: string;
}

/** Default LED overlay config — disabled with neutral green glow and solid pattern */
export const DEFAULT_LED_CONFIG: LedOverlayConfig = {
  enabled: false,
  glowRadius: 1.0,
  bloomIntensity: 0.04,
  trailFadeRate: 0.92,
  patternId: "solid",
  patternSpeed: 1.0,
  primaryColor: "#00ff88",
};

/**
 * Convert a CSS hex color (#rrggbb) to normalized [0, 1] RGB for shader use.
 */
export function hexToLedColor(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}
