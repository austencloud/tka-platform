/**
 * Fire pass payload.
 *
 * Drives a Navier-Stokes fluid sim on the GPU. The backend maintains
 * double-buffered velocity/density/temperature fields and runs
 * advection, diffusion, projection, and buoyancy steps per frame.
 */

export interface FireColorStop {
  /** Temperature threshold 0..1. */
  t: number;
  /** RGB color at this temperature. */
  color: [number, number, number];
}

export interface FireSourcePoint {
  /** Position in NDC. */
  position: [number, number];
  /** Velocity injection direction + magnitude. */
  velocity: [number, number];
  /** Temperature injection strength 0..1. */
  temperature: number;
  /** Density injection strength 0..1. */
  density: number;
  /** Splat radius in NDC. */
  radius: number;
}

export interface FirePassPayload {
  /** Per-tip source points (injected each frame as splats). */
  sources: FireSourcePoint[];
  /** 0..1 overall intensity - scales density + temperature injection. */
  intensity: number;
  /** Curl noise turbulence strength. */
  turbulence: number;
  /** Upward buoyancy factor. */
  buoyancy: number;
  /** 4-stop temperature→color gradient. */
  colorCurve: FireColorStop[];
  /** Simulation grid resolution. Default 256. */
  gridSize?: number;
  /** Jacobi iteration count for pressure solve. Default 20. */
  jacobiIterations?: number;
}
