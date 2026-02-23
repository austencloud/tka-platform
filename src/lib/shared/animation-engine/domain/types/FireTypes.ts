/**
 * Fire Overlay Types
 *
 * Domain types for the WebGL fire overlay that renders physically-based
 * fire at prop endpoints using Navier-Stokes fluid simulation with
 * combustion, buoyancy, and blackbody radiation rendering.
 */

import type { FireColorCurve, FuelRendererType, CharcoalParams } from "./FuelSourceTypes";
import { DEFAULT_FUEL_SOURCE_ID } from "./FuelSourceTypes";

/**
 * RGB color for a prop, normalized to [0, 1] for shader consumption.
 */
export interface PropFlameColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Per-tip data computed each frame by FireTipTracker.
 * Positions are in viewbox coordinates (e.g. 950x950).
 */
export interface PropTipData {
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
  /** Index of this fire point within the prop's fire point array */
  tipIndex: number;
  /** Relative flame size from PropFirePoints config (affects splat radius and fuel) */
  flameScale: number;
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
  /** Prop colors for colored flames: [leftPropColor, rightPropColor] */
  propColors?: [PropFlameColor, PropFlameColor];
  /** Set to true on the frame where the animation loops back to the start */
  loopDetected?: boolean;
  /** Playback speed multiplier (1.0 = 60 BPM). Used for cache invalidation — different speeds produce different fire physics. */
  playbackSpeed?: number;
}

/**
 * Physics parameters for the Navier-Stokes fluid simulation.
 * Each preset defines a complete set of these values.
 */
export interface FirePhysicsParams {
  /** Gaussian splat radius for fuel/velocity injection (0.004 - 0.025) */
  splatRadius: number;
  /** Base fuel injection amount per frame (0.1 - 2.0) */
  fuelAmount: number;
  /** How strongly tip velocity feeds into the sim (0.0001 - 0.002) */
  velocityInjectScale: number;
  /** Velocity field decay per step. Lower = faster decay = shorter trails (0.88 - 0.995) */
  velocityDissipation: number;
  /** Temperature field decay per step. Lower = faster cooling = shorter visible trail (0.88 - 0.995) */
  temperatureDissipation: number;
  /** Fuel field decay per step. Lower = fuel burns out faster (0.88 - 0.995) */
  fuelDissipation: number;
  /** Vorticity confinement strength. Higher = more turbulence/swirl (1.0 - 20.0) */
  vorticityStrength: number;
  /** How strongly hot gas rises. Needs ~30-150 for visible upward motion (10 - 200) */
  buoyancyStrength: number;
  /** How fast fuel converts to heat (1.0 - 8.0) */
  burnRate: number;
  /** Heat generated per unit fuel burned (1.0 - 5.0) */
  fuelEfficiency: number;
  /** Active cooling rate during combustion. Higher = faster cooldown (1.0 - 8.0) */
  coolingRate: number;
  /** Pressure field decay between Jacobi iterations (0.5 - 1.0) */
  pressureDissipation: number;
  /** Base temperature injection at each tip per frame (0.3 - 4.0) */
  temperatureInjection: number;
  /** Constant upward velocity injected at tip via splat (0.5 - 8.0) */
  upwardBias: number;
}

/**
 * User-configurable fire overlay settings.
 */
export interface FireOverlayConfig {
  /** Whether fire effect is enabled */
  enabled: boolean;
  /** Display intensity multiplier (0.1 - 3.0, default 1.0) */
  intensity: number;
  /** Flame height / buoyancy strength multiplier (0.3 - 3.0, default 1.0) */
  flameHeight: number;
  /** Whether fire reacts to spin velocity */
  velocityReactive: boolean;
  /**
   * Quality level controlling simulation resolution:
   *   2 = 128x128 grid (low, mobile-friendly)
   *   3 = 192x192 grid (medium)
   *   4 = 256x256 grid (high, default)
   */
  quality: number;
  /** Flame color blend: 0.0 = natural fire, 1.0 = prop-colored fire */
  colorBlend?: number;
  /** Optional physics preset to apply. When set, overrides the renderer's base physics. */
  physicsPreset?: FirePhysicsParams;
  /** Active fuel source ID (replaces preset system) */
  fuelSourceId?: string;
  /** Which renderer to use for this fuel */
  fuelRendererType?: FuelRendererType;
  /** Color curve for the fluid renderer display pass */
  colorCurve?: FireColorCurve;
  /** Charcoal particle params (when fuelRendererType === "particle") */
  charcoalParams?: CharcoalParams;
  /**
   * Jacobi pressure-solve iterations per frame.
   * Higher = more accurate pressure field, but more GPU draw calls.
   * Fire doesn't need physical accuracy — visual plausibility is sufficient.
   *   20 = default (single instance, no visible difference from 30)
   *   15 = 2-4 simultaneous instances
   *   10 = 5+ simultaneous instances
   */
  jacobiIterations?: number;
}

/** Default physics parameters — tuned for fire spinning (shorter trails, wick-focused) */
export const DEFAULT_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.011,
  fuelAmount: 0.55,
  velocityInjectScale: 0.0006,
  velocityDissipation: 0.955,
  temperatureDissipation: 0.945,
  fuelDissipation: 0.935,
  vorticityStrength: 3.5,
  buoyancyStrength: 40,
  burnRate: 3.5,
  fuelEfficiency: 2.5,
  coolingRate: 3.5,
  pressureDissipation: 0.8,
  temperatureInjection: 1.1,
  upwardBias: 2.0,
};

/** Default fire overlay config */
export const DEFAULT_FIRE_CONFIG: FireOverlayConfig = {
  enabled: false,
  intensity: 1.0,
  flameHeight: 1.0,
  velocityReactive: true,
  quality: 4,
  fuelSourceId: DEFAULT_FUEL_SOURCE_ID,
};

/**
 * Convert a CSS hex color (#rrggbb) to normalized [0,1] RGB for shader use.
 */
export function hexToFlameColor(hex: string): PropFlameColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/** Default prop flame colors (blue/red) */
export const DEFAULT_PROP_FLAME_COLORS: [PropFlameColor, PropFlameColor] = [
  hexToFlameColor("#3b82f6"), // blue (left prop)
  hexToFlameColor("#ef4444"), // red (right prop)
];
