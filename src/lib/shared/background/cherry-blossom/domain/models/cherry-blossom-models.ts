/**
 * Domain models for Cherry Blossom background
 */

/** Parallax depth layer for 3D depth effect */
export type PetalDepth = "far" | "mid" | "near";

export interface CherryPetal {
  x: number; // Horizontal position
  y: number; // Vertical position
  size: number; // Size of the petal (base size before depth multiplier)
  vx: number; // Horizontal velocity (drift)
  vy: number; // Vertical velocity (falling)
  baseVy: number; // Base falling speed (before tumble modulation)
  rotation: number; // Current rotation angle
  rotationSpeed: number; // Rotation speed
  opacity: number; // Current opacity (base opacity before depth multiplier)
  swayOffset: number; // Primary sway oscillation phase
  swayAmplitude: number; // How much the petal sways
  secondarySwayOffset: number; // Secondary oscillation for complexity
  tumblePhase: number; // Phase for tumble-drag coupling
  tumbleSpeed: number; // How fast the tumble phase advances
  flutterIntensity: number; // How much this petal flutters (0-1)
  driftBias: number; // Tendency to drift left (-1) or right (1)
  color: { r: number; g: number; b: number }; // RGB color values
  isFlower: boolean; // True if this is a full flower, false if just a petal
  depth: PetalDepth; // Parallax depth layer (far/mid/near)
}

export interface CherryCluster {
  x: number; // Center position
  y: number; // Center position
  petals: CherryPetal[]; // Petals in this cluster
  vy: number; // Falling speed for the whole cluster
}
