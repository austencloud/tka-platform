/**
 * Tree Silhouette System Models
 *
 * Type definitions for tree silhouette rendering system.
 */

// ===================
// TREE TYPES
// ===================

export type TreeType =
  | "pine"
  | "fir"
  | "spruce"
  | "oak"
  | "maple"
  | "poplar"
  | "willow"
  | "dead";

export interface TreeTypeVisibility {
  pine: boolean;
  fir: boolean;
  spruce: boolean;
  oak: boolean;
  maple: boolean;
  poplar: boolean;
  willow: boolean;
  dead: boolean;
}

export interface RenderedTree {
  id: string;
  x: number;
  height: number;
  width: number;
  type: TreeType;
  layer: number; // 0 = far, 6 = near
  seed: number; // For deterministic image selection
  imageFilename?: string; // The actual image used for this tree
}

// ===================
// LAYER CONFIGURATION
// ===================

/**
 * Grid-based placement configuration.
 * Each layer uses specific columns to avoid overlap within a layer.
 * Layers use offset columns so trees naturally interleave.
 */
export interface LayerConfig {
  columns: number[]; // Which grid columns this layer uses (0-9)
  heightPresets: number[]; // Predetermined height ratios for balanced composition
  widthRange: [number, number]; // min, max as ratio of canvas height
}

// ===================
// SPECIES SCALING
// ===================

/**
 * Species-specific scale factors for realistic proportions.
 * Based on natural growth characteristics of each tree type.
 */
export interface TreeTypeScale {
  heightMin: number; // Multiplier for minimum height
  heightMax: number; // Multiplier for maximum height
  widthMin: number; // Multiplier for minimum width
  widthMax: number; // Multiplier for maximum width
}

// ===================
// PLACEMENT CONFIGURATION
// ===================

/**
 * Configurable placement parameters.
 * Exposed for Lab UI sliders.
 */
export interface PlacementConfig {
  /** Minimum spacing for same-layer trees (0-0.15, higher = more spread out) */
  minSpacing: number;
  /** Cross-layer collision threshold (0-0.15, higher = more separation between layers) */
  crossLayerThreshold: number;
  /** Position jitter amount (0-0.5, higher = more random placement) */
  jitter: number;
  /** Hero anchor strength (0-1, 0 = disabled, 1 = always snap to thirds) */
  heroStrength: number;
}

/**
 * Internal placement constants derived from PlacementConfig.
 */
export interface PlacementConstants {
  HERO_ANCHORS: number[];
  MIN_SPACING: {
    far: number;
    mid: number;
    near: number;
  };
  CROSS_LAYER_THRESHOLD: number;
  NUDGE_STEP: number;
  MAX_NUDGE: number;
  EDGE_MARGIN: number;
  HERO_HEIGHT_BOOST: number;
  HERO_SNAP_DISTANCE: number;
  JITTER: number;
}

/**
 * A placed tree for collision detection.
 */
export interface PlacedTree {
  x: number;
  layer: number;
}

// ===================
// ECOLOGICAL PATTERNS
// ===================

/**
 * Ecological zone defines which tree types are weighted in a region of the canvas.
 * x positions are normalized 0-1 across the canvas width.
 */
export interface EcologicalZone {
  startX: number; // 0-1 normalized start position
  endX: number; // 0-1 normalized end position
  weights: Partial<Record<TreeType, number>>; // Higher weight = more likely
}

/**
 * An ecological pattern defines how tree types are distributed across the scene.
 */
export interface EcologicalPattern {
  id: string;
  name: string;
  description: string;
  zones: EcologicalZone[];
}

// ===================
// COLOR TYPES
// ===================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Colors for rendering a tree at a given depth.
 */
export interface TreeColors {
  silhouette: RGB;
}
