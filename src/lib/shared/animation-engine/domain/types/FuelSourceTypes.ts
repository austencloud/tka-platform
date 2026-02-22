import type { FirePhysicsParams } from "./FireTypes";

/** Renderer type determines which WebGL pipeline handles this fuel */
export type FuelRendererType = "fluid" | "particle";

/** Color curve for the fluid renderer's display pass.
 *  Maps normalized temperature through 4 color stops
 *  instead of the hardcoded blackbody ramp. */
export interface FireColorCurve {
  /** RGB [0-1] at lowest visible temperature (dark ember glow) */
  coldColor: [number, number, number];
  /** RGB [0-1] at mid combustion (main flame body) */
  midColor: [number, number, number];
  /** RGB [0-1] at peak combustion (bright flame) */
  hotColor: [number, number, number];
  /** RGB [0-1] at wick core (brightest point, near-white) */
  coreColor: [number, number, number];
}

/** Charcoal/steel wool particle physics params */
export interface CharcoalParams {
  /** Sparks emitted per second per tip */
  sparkRate: number;
  /** Seconds before a spark fades out completely */
  sparkLifetime: number;
  /** Multiplier on tip velocity for initial spark speed */
  sparkInitialSpeed: number;
  /** Scatter cone angle in degrees around tangential direction */
  sparkScatter: number;
  /** Base particle render size in pixels */
  sparkSize: number;
  /** Random size variation (0.0-1.0, multiplied by sparkSize) */
  sparkSizeVariance: number;
  /** Downward acceleration in units/s^2 */
  gravity: number;
  /** Air resistance coefficient (velocity decay per second) */
  dragCoefficient: number;
  /** Probability (0.0-1.0) of spawning secondary branching sparks */
  secondarySparkChance: number;
  /** How long ember glow persists after spark stops moving (seconds) */
  emberGlowDuration: number;
  /** Temperature decay rate (normalized units per ms) */
  coolingRate: number;
  /** Starting temperature in normalized units (1.0 = brightest) */
  initialTemperature: number;
}

/** A fuel source document -- stored in Firestore, with baked-in defaults */
export interface FuelSourceDocument {
  /** Unique identifier: "white-gas", "lamp-oil", "isopropyl", "charcoal" */
  id: string;
  /** Display name shown in the fuel picker */
  name: string;
  /** One-line description */
  description: string;
  /** Which rendering pipeline this fuel uses */
  rendererType: FuelRendererType;
  /** Navier-Stokes physics params (required when rendererType === "fluid") */
  fluidParams?: FirePhysicsParams;
  /** Display color curve (required when rendererType === "fluid") */
  colorCurve?: FireColorCurve;
  /** Charcoal particle params (required when rendererType === "particle") */
  particleParams?: CharcoalParams;
  /** true for the 4 built-in defaults, false for admin-created custom fuels */
  builtIn: boolean;
  /** Sort order in the picker */
  sortOrder: number;
}

/** The fuel source ID stored in user settings */
export const DEFAULT_FUEL_SOURCE_ID = "white-gas";
