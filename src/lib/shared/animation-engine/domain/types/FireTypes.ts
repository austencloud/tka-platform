/**
 * Fire Overlay Types
 *
 * Domain types for the WebGL fire overlay that renders physically-based
 * fire at prop endpoints using Navier-Stokes fluid simulation with
 * combustion, buoyancy, and blackbody radiation rendering.
 */

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
  /** Optional physics preset to apply. When set, overrides the renderer's base physics. */
  physicsPreset?: FirePhysicsParams;
}

/** Default physics parameters — balanced starting point */
export const DEFAULT_PHYSICS: FirePhysicsParams = {
  splatRadius: 0.012,
  fuelAmount: 0.6,
  velocityInjectScale: 0.0005,
  velocityDissipation: 0.96,
  temperatureDissipation: 0.95,
  fuelDissipation: 0.94,
  vorticityStrength: 5.0,
  buoyancyStrength: 50,
  burnRate: 3.5,
  fuelEfficiency: 2.5,
  coolingRate: 3.0,
  pressureDissipation: 0.8,
  temperatureInjection: 1.2,
  upwardBias: 3.0,
};

/** Default fire overlay config */
export const DEFAULT_FIRE_CONFIG: FireOverlayConfig = {
  enabled: false,
  intensity: 1.0,
  flameHeight: 1.0,
  velocityReactive: true,
  quality: 4,
};
