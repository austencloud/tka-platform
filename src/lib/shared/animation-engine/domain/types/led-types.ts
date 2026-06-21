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
  /** 0 = base blue prop, 1 = base red prop; >= 2 = overlaid tunnel-layer props */
  propIndex: number;
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

/** How per-hand LED colors are determined */
export type LedColorMode = "unified" | "per-hand" | "prop-matched";

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
  /** Secondary color for dual-color patterns, expressed as a CSS hex string (e.g. "#ffffff") */
  secondaryColor: string;
  /**
   * Global brightness multiplier (0.0 - 1.0, default 1.0).
   * Applied on top of per-LED brightness values.
   * Maps to 5 discrete user-facing levels via LED_BRIGHTNESS_LEVELS.
   */
  brightness: number;
  /** How per-hand colors are resolved: unified, per-hand, or prop-matched */
  colorMode: LedColorMode;
  /** Custom color for the blue hand (propIndex 0) when colorMode is "per-hand" */
  blueHandColor: string;
  /** Custom color for the red hand (propIndex 1) when colorMode is "per-hand" */
  redHandColor: string;
}

/** Canonical prop colors matching the domain (blue hand = propIndex 0, red hand = propIndex 1) */
export const PROP_BLUE = "#2196f3";
export const PROP_RED = "#f44336";

/**
 * Default LED overlay config - disabled, solid pattern, prop-matched colors.
 * colorMode is "prop-matched" so each hand's LEDs take the canonical blue/red
 * prop identity out of the box (no neon-green wash from a "unified" primary).
 * brightness defaults to level 3 (0.6) — full-bright (1.0) reads as blinding
 * against the dark stage.
 */
export const DEFAULT_LED_CONFIG: LedOverlayConfig = {
  enabled: false,
  glowRadius: 1.0,
  bloomIntensity: 0.04,
  trailFadeRate: 0.92,
  patternId: "solid",
  patternSpeed: 1.0,
  primaryColor: "#66ccff",
  secondaryColor: "#ffffff",
  brightness: 0.6,
  colorMode: "prop-matched",
  blueHandColor: PROP_BLUE,
  redHandColor: PROP_RED,
};

/**
 * Discrete brightness levels matching physical LED prop controls.
 * Index 0 = dimmest (level 1), index 4 = full brightness (level 5).
 */
export const LED_BRIGHTNESS_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0] as const;

/**
 * Convert a user-facing brightness level (1-5) to a 0-1 float.
 * Clamps out-of-range inputs to the nearest valid level.
 */
export function ledBrightnessToFloat(level: number): number {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  return LED_BRIGHTNESS_LEVELS[clamped - 1]!;
}

/**
 * Convert a CSS hex color (#rrggbb) to normalized [0, 1] RGB for shader use.
 */
export function hexToLedColor(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/**
 * Resolve the base color hex string for a given hand based on the color mode.
 * propIndex 0 = blue hand, propIndex 1 = red hand.
 */
export function resolveHandColor(config: LedOverlayConfig, propIndex: 0 | 1): string {
  switch (config.colorMode) {
    case "unified":
      return config.primaryColor;
    case "per-hand":
      return propIndex === 0 ? config.blueHandColor : config.redHandColor;
    case "prop-matched":
      return propIndex === 0 ? PROP_BLUE : PROP_RED;
  }
}
