/**
 * Tree Silhouette System Constants
 *
 * Configuration constants for tree silhouette rendering.
 */

import type {
  LayerConfig,
  TreeType,
  TreeTypeScale,
  EcologicalPattern,
  PlacementConfig,
  RGB,
} from "../models/tree-silhouette-models";

// ===================
// LAYER CONFIGURATION
// ===================

export const NUM_LAYERS = 7;
export const NUM_COLUMNS = 10;

/**
 * 10-column grid, each layer uses different columns.
 * Heights are curated to create pleasing silhouette with variety.
 * 7 layers for smooth depth gradation (far to near).
 */
export const LAYER_CONFIGS: LayerConfig[] = [
  // Layer 0: Farthest (tiny, hazy trees on horizon)
  {
    columns: [0.5, 2, 4, 6, 8, 9.5],
    heightPresets: [0.12, 0.14, 0.11, 0.13, 0.15, 0.12],
    widthRange: [0.03, 0.045],
  },
  // Layer 1: Very far
  {
    columns: [1, 3, 5, 7, 9],
    heightPresets: [0.17, 0.19, 0.16, 0.18, 0.2],
    widthRange: [0.04, 0.055],
  },
  // Layer 2: Far
  {
    columns: [0, 1.5, 3.5, 5.5, 7.5, 9],
    heightPresets: [0.22, 0.25, 0.21, 0.24, 0.23, 0.22],
    widthRange: [0.05, 0.07],
  },
  // Layer 3: Mid-far
  {
    columns: [0.5, 2.5, 4.5, 6.5, 8.5],
    heightPresets: [0.29, 0.32, 0.28, 0.31, 0.3],
    widthRange: [0.065, 0.085],
  },
  // Layer 4: Mid
  {
    columns: [1, 3, 5, 7, 9.5],
    heightPresets: [0.36, 0.4, 0.34, 0.38, 0.37],
    widthRange: [0.08, 0.1],
  },
  // Layer 5: Mid-near
  {
    columns: [0, 2.5, 5, 7.5, 10],
    heightPresets: [0.44, 0.48, 0.42, 0.46, 0.45],
    widthRange: [0.1, 0.13],
  },
  // Layer 6: Nearest (large silhouettes)
  {
    columns: [1, 4, 7, 9.5],
    heightPresets: [0.54, 0.6, 0.52, 0.56],
    widthRange: [0.13, 0.17],
  },
];

// ===================
// SPECIES SCALING
// ===================

/**
 * Species-specific scale factors based on natural growth characteristics.
 */
export const TREE_TYPE_SCALES: Record<TreeType, TreeTypeScale> = {
  // Oak: Massive, wide spreading crown, moderate height
  oak: { heightMin: 0.85, heightMax: 1.05, widthMin: 1.3, widthMax: 1.6 },

  // Pine: Tall with visible trunk, medium spread
  pine: { heightMin: 1.0, heightMax: 1.2, widthMin: 0.85, widthMax: 1.1 },

  // Fir: Very tall, narrow conical shape (Douglas fir, etc.)
  fir: { heightMin: 1.1, heightMax: 1.35, widthMin: 0.65, widthMax: 0.85 },

  // Spruce: Tall, conical, slightly wider than fir
  spruce: { heightMin: 1.05, heightMax: 1.25, widthMin: 0.7, widthMax: 0.9 },

  // Maple: Medium height broadleaf, rounded crown
  maple: { heightMin: 0.8, heightMax: 1.0, widthMin: 1.0, widthMax: 1.25 },

  // Poplar: Very tall and narrow, columnar shape (Lombardy poplar)
  poplar: { heightMin: 1.2, heightMax: 1.45, widthMin: 0.45, widthMax: 0.65 },

  // Willow: Medium height, very wide drooping crown
  willow: { heightMin: 0.75, heightMax: 0.95, widthMin: 1.25, widthMax: 1.55 },

  // Dead: Variable, typically shorter and narrower than living trees
  dead: { heightMin: 0.65, heightMax: 0.95, widthMin: 0.6, widthMax: 0.9 },
};

// ===================
// PLACEMENT DEFAULTS
// ===================

/**
 * Default placement config - balanced between natural and composed.
 */
export const DEFAULT_PLACEMENT: PlacementConfig = {
  minSpacing: 0.04,
  crossLayerThreshold: 0.03,
  jitter: 0.3,
  heroStrength: 0.5,
};

// ===================
// COLOR CONSTANTS
// ===================

/**
 * Night silhouette color palette - pure darkness with subtle atmospheric fade.
 * Most trees stay dark; only the very farthest get a subtle haze lift.
 */
export const FAR_SILHOUETTE: RGB = { r: 18, g: 22, b: 28 }; // Subtle distant haze
export const NEAR_SILHOUETTE: RGB = { r: 0, g: 0, b: 0 }; // Pure black silhouette

/** Rim light color - subtle moonlight edge glow */
export const RIM_LIGHT: RGB = { r: 35, g: 45, b: 55 };

// ===================
// ECOLOGICAL PATTERNS
// ===================

/**
 * Preset ecological patterns based on real-world forest biomes.
 *
 * VISUAL DISTINCTIVENESS GUIDE:
 * - Conifers (pine/fir/spruce): Triangular, pointed tops
 * - Oak/Maple: Wide, rounded crowns
 * - Poplar: VERY tall and narrow (columnar) - most distinctive!
 * - Willow: Wide, droopy branches
 * - Dead: Sparse, skeletal
 *
 * Patterns are designed to create VISIBLE differences through shape variety.
 */
export const ECOLOGICAL_PATTERNS: EcologicalPattern[] = [
  {
    id: "random",
    name: "Random Mix",
    description: "Uniform random distribution of all tree types",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: {
          pine: 1,
          fir: 1,
          spruce: 1,
          oak: 1,
          maple: 1,
          poplar: 1,
          willow: 1,
          dead: 1,
        },
      },
    ],
  },
  // === SINGLE-TYPE PATTERNS (for testing/dramatic effect) ===
  {
    id: "conifers-only",
    name: "Conifer Forest",
    description: "100% conifers - triangular silhouettes only",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: { pine: 3, fir: 3, spruce: 3 },
      },
    ],
  },
  {
    id: "deciduous-only",
    name: "Deciduous Grove",
    description: "100% broadleaf - wide rounded crowns",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: { oak: 4, maple: 4, willow: 2 },
      },
    ],
  },
  {
    id: "poplar-avenue",
    name: "Poplar Avenue",
    description: "Tall narrow poplars - dramatic columnar silhouettes",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: { poplar: 10, dead: 1 },
      },
    ],
  },
  {
    id: "willow-wetland",
    name: "Willow Wetland",
    description: "Drooping willows with scattered dead trees",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: { willow: 10, dead: 2 },
      },
    ],
  },
  {
    id: "haunted-forest",
    name: "Haunted Forest",
    description: "Mostly dead trees with sparse survivors",
    zones: [
      {
        startX: 0,
        endX: 1,
        weights: { dead: 8, oak: 1, pine: 1 },
      },
    ],
  },
  // === MIXED PATTERNS (realistic biomes) ===
  {
    id: "conifer-ridge",
    name: "Conifer Ridge",
    description: "Triangular conifers on left, rounded deciduous on right",
    zones: [
      {
        startX: 0,
        endX: 0.4,
        weights: { pine: 5, fir: 5, spruce: 5 },
      },
      {
        startX: 0.4,
        endX: 0.6,
        weights: { pine: 2, oak: 3, maple: 3, dead: 1 },
      },
      {
        startX: 0.6,
        endX: 1,
        weights: { oak: 5, maple: 4, willow: 2 },
      },
    ],
  },
  {
    id: "riparian",
    name: "Riparian Corridor",
    description: "Tall poplars and droopy willows in center stream",
    zones: [
      {
        startX: 0,
        endX: 0.25,
        weights: { oak: 5, maple: 4 },
      },
      {
        startX: 0.25,
        endX: 0.75,
        weights: { willow: 6, poplar: 6, dead: 1 },
      },
      {
        startX: 0.75,
        endX: 1,
        weights: { oak: 5, maple: 4 },
      },
    ],
  },
  {
    id: "edge-habitat",
    name: "Poplar Windbreak",
    description: "Tall narrow poplars at edges, mixed forest center",
    zones: [
      {
        startX: 0,
        endX: 0.15,
        weights: { poplar: 10 },
      },
      {
        startX: 0.15,
        endX: 0.85,
        weights: { oak: 3, maple: 3, pine: 2, fir: 2, dead: 1 },
      },
      {
        startX: 0.85,
        endX: 1,
        weights: { poplar: 10 },
      },
    ],
  },
  {
    id: "alpine-transition",
    name: "Alpine Treeline",
    description: "Dense conifers thin to dead trees at treeline",
    zones: [
      {
        startX: 0,
        endX: 0.4,
        weights: { pine: 4, fir: 4, spruce: 4 },
      },
      {
        startX: 0.4,
        endX: 0.7,
        weights: { pine: 2, spruce: 2, dead: 3 },
      },
      {
        startX: 0.7,
        endX: 1,
        weights: { dead: 10, pine: 1 },
      },
    ],
  },
];
