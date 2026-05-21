/**
 * Coral Silhouette Types
 *
 * Domain types for the coral formations that sit along the ocean floor
 * in the Ocean background.
 */

/** Category derived from the PNG filename prefix */
export type CoralCategory = "fan" | "reef" | "rock";

/** Depth layer for compositing - controls scale, opacity, and tint */
export type CoralDepthLayer = "back" | "mid" | "front";

/** Static definition of a coral asset from the manifest */
export interface CoralAssetDefinition {
  filename: string;
  category: CoralCategory;
  path: string;
}

/** A coral asset after loading and tinting to an offscreen canvas */
export interface TintedCoralAsset {
  definition: CoralAssetDefinition;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  width: number;
  height: number;
  tintColor: string;
}

/** Color palette used for tinting coral at each depth layer */
export interface CoralTintPalette {
  back: string[];
  mid: string[];
  front: string[];
}

/** A coral instance placed in the scene with transform and animation state */
export interface PlacedCoral {
  asset: TintedCoralAsset;
  layer: CoralDepthLayer;
  /** X position (center of coral base), in pixels */
  x: number;
  /** Y position (bottom of coral), in pixels */
  y: number;
  /** Uniform scale factor */
  scale: number;
  /** Whether to mirror horizontally */
  flipX: boolean;
  /** Opacity (0-1) */
  opacity: number;
  /** Sway amplitude in radians */
  swayAmplitude: number;
  /** Sway angular speed in rad/s */
  swaySpeed: number;
  /** Sway phase offset in radians */
  swayPhase: number;
  /** Current sway angle in radians (updated each frame) */
  currentSwayAngle: number;
}

/** Default tint palettes per depth layer - deep ocean hues */
export const DEFAULT_CORAL_TINT_PALETTE: CoralTintPalette = {
  back: ["#0a1e3d", "#0d2847", "#112244", "#0b1f3a"],
  mid: ["#1a3a5c", "#1e3d6b", "#243b6e", "#2a3f72"],
  front: ["#2d6b7a", "#3a7d8a", "#1f7a6d", "#8b5a6b"],
};
