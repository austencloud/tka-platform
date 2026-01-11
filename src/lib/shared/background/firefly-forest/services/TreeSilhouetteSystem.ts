import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import {
  createTreeSilhouetteImageLoader,
  type TreeCategory,
  type TreeSilhouetteImageLoader,
} from "./TreeSilhouetteImageLoader";

export type TreeType = "pine" | "fir" | "spruce" | "oak" | "maple" | "poplar" | "willow" | "dead";

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

interface Tree {
  x: number;
  height: number;
  width: number;
  type: TreeType;
  layer: number; // 0 = far, 1 = mid, 2 = near
  seed: number; // For deterministic image selection
}

// Grid-based placement configuration
// Each layer uses specific columns to avoid overlap within a layer
// Layers use offset columns so trees naturally interleave
interface LayerConfig {
  columns: number[]; // Which grid columns this layer uses (0-9)
  heightPresets: number[]; // Predetermined height ratios for balanced composition
  widthRange: [number, number]; // min, max as ratio of canvas height
}

// 10-column grid, each layer uses different columns
// Heights are curated to create pleasing silhouette with variety
// 7 layers for smooth depth gradation (far to near)
const LAYER_CONFIGS: LayerConfig[] = [
  // Layer 0: Farthest (tiny, hazy trees on horizon)
  {
    columns: [0.5, 2, 4, 6, 8, 9.5],
    heightPresets: [0.12, 0.14, 0.11, 0.13, 0.15, 0.12],
    widthRange: [0.03, 0.045],
  },
  // Layer 1: Very far
  {
    columns: [1, 3, 5, 7, 9],
    heightPresets: [0.17, 0.19, 0.16, 0.18, 0.20],
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
    heightPresets: [0.29, 0.32, 0.28, 0.31, 0.30],
    widthRange: [0.065, 0.085],
  },
  // Layer 4: Mid
  {
    columns: [1, 3, 5, 7, 9.5],
    heightPresets: [0.36, 0.40, 0.34, 0.38, 0.37],
    widthRange: [0.08, 0.10],
  },
  // Layer 5: Mid-near
  {
    columns: [0, 2.5, 5, 7.5, 10],
    heightPresets: [0.44, 0.48, 0.42, 0.46, 0.45],
    widthRange: [0.10, 0.13],
  },
  // Layer 6: Nearest (large silhouettes)
  {
    columns: [1, 4, 7, 9.5],
    heightPresets: [0.54, 0.60, 0.52, 0.56],
    widthRange: [0.13, 0.17],
  },
];

export const NUM_LAYERS = 7;
const NUM_COLUMNS = 10;

// Species-specific scale factors for realistic proportions
// Based on natural growth characteristics of each tree type
interface TreeTypeScale {
  heightMin: number;  // Multiplier for minimum height
  heightMax: number;  // Multiplier for maximum height
  widthMin: number;   // Multiplier for minimum width
  widthMax: number;   // Multiplier for maximum width
}

const TREE_TYPE_SCALES: Record<TreeType, TreeTypeScale> = {
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
// ECOLOGICAL PATTERN SYSTEM
// ===================

/**
 * Ecological zone defines which tree types are weighted in a region of the canvas
 * x positions are normalized 0-1 across the canvas width
 */
interface EcologicalZone {
  startX: number;  // 0-1 normalized start position
  endX: number;    // 0-1 normalized end position
  weights: Partial<Record<TreeType, number>>;  // Higher weight = more likely
}

/**
 * An ecological pattern defines how tree types are distributed across the scene
 */
export interface EcologicalPattern {
  id: string;
  name: string;
  description: string;
  zones: EcologicalZone[];
}

/**
 * Preset ecological patterns based on real-world forest biomes
 *
 * VISUAL DISTINCTIVENESS GUIDE:
 * - Conifers (pine/fir/spruce): Triangular, pointed tops
 * - Oak/Maple: Wide, rounded crowns
 * - Poplar: VERY tall and narrow (columnar) - most distinctive!
 * - Willow: Wide, droopy branches
 * - Dead: Sparse, skeletal
 *
 * Patterns are designed to create VISIBLE differences through shape variety
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
        weights: { pine: 1, fir: 1, spruce: 1, oak: 1, maple: 1, poplar: 1, willow: 1, dead: 1 },
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

// ===================
// A+ PLACEMENT SYSTEM
// Cross-layer collision avoidance, minimum spacing, compositional anchors
// ===================

/** Configurable placement parameters - exposed for Lab UI sliders */
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

/** Default placement config - balanced between natural and composed */
const DEFAULT_PLACEMENT: PlacementConfig = {
  minSpacing: 0.04,
  crossLayerThreshold: 0.03,
  jitter: 0.3,
  heroStrength: 0.5,
};

/** Internal placement constants derived from config */
function getPlacementConstants(config: PlacementConfig) {
  return {
    HERO_ANCHORS: [0.333, 0.667],
    MIN_SPACING: {
      far: config.minSpacing,
      mid: config.minSpacing * 1.5,
      near: config.minSpacing * 2.25,
    },
    CROSS_LAYER_THRESHOLD: config.crossLayerThreshold,
    NUDGE_STEP: 0.015,
    MAX_NUDGE: 0.12,
    EDGE_MARGIN: 0.04,
    HERO_HEIGHT_BOOST: 1.08,
    HERO_SNAP_DISTANCE: 0.12 * config.heroStrength,
    JITTER: config.jitter,
  };
}

/**
 * Creates forest silhouettes rising from the bottom of the screen
 * Trees are dark shapes against the sky - no ground layers needed
 */
export function createTreeSilhouetteSystem() {
  // One cached canvas per layer for interleaved rendering with grass
  let layerCanvases: (OffscreenCanvas | null)[] = Array(NUM_LAYERS).fill(null);
  let cachedDimensions: Dimensions | null = null;
  let currentVisibility: TreeTypeVisibility = {
    pine: true,
    fir: true,
    spruce: true,
    oak: true,
    maple: true,
    poplar: true,
    willow: true,
    dead: true,
  };

  // Image-based tree rendering
  const imageLoader: TreeSilhouetteImageLoader = createTreeSilhouetteImageLoader();
  let imagesLoaded = false;

  // Track used images to prevent duplicates in the same scene
  let usedImages: Set<string> = new Set();

  // Configurable placement parameters
  let placementConfig: PlacementConfig = { ...DEFAULT_PLACEMENT };

  // Ecological pattern state
  let currentPatternId: string = "random";  // Default to random distribution

  type RenderContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  // Night silhouette color palette - pure darkness with subtle atmospheric fade
  // Most trees stay dark; only the very farthest get a subtle haze lift
  const FAR_SILHOUETTE = { r: 18, g: 22, b: 28 }; // Subtle distant haze - very dark blue-gray
  const NEAR_SILHOUETTE = { r: 0, g: 0, b: 0 }; // Pure black silhouette

  // Rim light color - subtle moonlight edge glow
  const RIM_LIGHT = { r: 35, g: 45, b: 55 };

  interface RGB {
    r: number;
    g: number;
    b: number;
  }

  /** Interpolate between two RGB colors */
  function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
    return {
      r: Math.floor(c1.r + (c2.r - c1.r) * t),
      g: Math.floor(c1.g + (c2.g - c1.g) * t),
      b: Math.floor(c1.b + (c2.b - c1.b) * t),
    };
  }

  /** Convert RGB to CSS string */
  function rgbToString(color: RGB, alpha = 1): string {
    if (alpha < 1) {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  // Seeded random for small variations (jitter)
  let seed = Date.now();

  function seededRandom(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function resetSeed(): void {
    seed = Date.now();
  }

  /**
   * Get the current ecological pattern
   */
  function getCurrentPattern(): EcologicalPattern {
    return ECOLOGICAL_PATTERNS.find(p => p.id === currentPatternId) || ECOLOGICAL_PATTERNS[0]!;
  }

  /**
   * Find which zone a position falls into for the current pattern
   */
  function getZoneForPosition(normalizedX: number): EcologicalZone | null {
    const pattern = getCurrentPattern();
    for (const zone of pattern.zones) {
      if (normalizedX >= zone.startX && normalizedX < zone.endX) {
        return zone;
      }
    }
    // Fallback to last zone if at exact end
    return pattern.zones[pattern.zones.length - 1] || null;
  }

  /**
   * Pick a tree type based on position and current ecological pattern
   * Respects visibility settings and zone weights
   */
  function pickTypeForPosition(normalizedX: number, enabledTypes: TreeType[]): TreeType {
    const zone = getZoneForPosition(normalizedX);

    if (!zone) {
      // Fallback to uniform random from enabled types
      return enabledTypes[Math.floor(seededRandom() * enabledTypes.length)]!;
    }

    // Build weighted list of enabled types only
    const weightedOptions: Array<{ type: TreeType; weight: number }> = [];
    let totalWeight = 0;

    for (const type of enabledTypes) {
      const weight = zone.weights[type] ?? 0;
      if (weight > 0) {
        weightedOptions.push({ type, weight });
        totalWeight += weight;
      }
    }

    // If no weighted options available, fall back to uniform random
    if (weightedOptions.length === 0 || totalWeight === 0) {
      return enabledTypes[Math.floor(seededRandom() * enabledTypes.length)]!;
    }

    // Weighted random selection
    const roll = seededRandom() * totalWeight;
    let cumulative = 0;
    for (const option of weightedOptions) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return option.type;
      }
    }

    // Fallback (shouldn't reach here)
    return weightedOptions[weightedOptions.length - 1]!.type;
  }

  /**
   * Get x position for a grid column with configurable jitter
   */
  function getColumnX(column: number, canvasWidth: number): number {
    const placement = getPlacementConstants(placementConfig);
    const margin = canvasWidth * placement.EDGE_MARGIN;
    const usableWidth = canvasWidth - margin * 2;
    const columnWidth = usableWidth / NUM_COLUMNS;
    // Center of column + jitter (scaled by config)
    const jitterAmount = (seededRandom() - 0.5) * columnWidth * placement.JITTER;
    return margin + columnWidth * (column + 0.5) + jitterAmount;
  }

  // ===================
  // IMAGE-BASED TREE RENDERING
  // ===================

  /**
   * Draw a tree using a pre-loaded silhouette image
   * Applies depth-based tinting for atmospheric perspective
   */
  function drawTreeImage(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    treeType: TreeType,
    layer: number,
    seed: number
  ): boolean {
    // Use unique selector to prevent duplicate trees in the same scene
    const treeImage = imageLoader.getUniqueFromCategory(treeType as TreeCategory, usedImages, seed);
    if (!treeImage) return false;

    // Track this image as used
    usedImages.add(treeImage.filename);

    // Calculate draw dimensions maintaining aspect ratio
    const targetHeight = height;
    const targetWidth = targetHeight * treeImage.aspectRatio;

    // Position: center horizontally at x, bottom at baseY
    const drawX = x - targetWidth / 2;
    const drawY = baseY - targetHeight;

    // Get depth-based color
    const colors = getTreeColors(layer);

    // Create a temporary canvas for tinting
    const tempCanvas = new OffscreenCanvas(Math.ceil(targetWidth), Math.ceil(targetHeight));
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return false;

    // Draw the silhouette scaled
    tempCtx.drawImage(
      treeImage.canvas as CanvasImageSource,
      0, 0, treeImage.width, treeImage.height,
      0, 0, targetWidth, targetHeight
    );

    // Apply darkness-based tint using composite operation
    // Far trees get lifted by atmospheric haze, near trees stay pure black
    tempCtx.globalCompositeOperation = 'source-atop';
    tempCtx.fillStyle = rgbToString(colors.silhouette);
    tempCtx.fillRect(0, 0, targetWidth, targetHeight);

    // Draw to main canvas
    ctx.drawImage(tempCanvas as CanvasImageSource, drawX, drawY);

    // Apply rim light effect
    // For images, we draw a subtle glow behind
    const t = layer / (NUM_LAYERS - 1);
    const rimOpacity = 0.15 + t * 0.2;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.shadowColor = rgbToString(RIM_LIGHT, rimOpacity);
    ctx.shadowBlur = 2 + t * 3;
    ctx.drawImage(tempCanvas as CanvasImageSource, drawX, drawY);
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';

    return true;
  }

  // ===================
  // TREE GENERATION
  // ===================

  function getEnabledTypes(): TreeType[] {
    const types: TreeType[] = [];
    if (currentVisibility.pine) types.push("pine");
    if (currentVisibility.fir) types.push("fir");
    if (currentVisibility.spruce) types.push("spruce");
    if (currentVisibility.oak) types.push("oak");
    if (currentVisibility.maple) types.push("maple");
    if (currentVisibility.poplar) types.push("poplar");
    if (currentVisibility.willow) types.push("willow");
    if (currentVisibility.dead) types.push("dead");
    return types;
  }

  // ===================
  // A+ PLACEMENT HELPERS
  // ===================

  interface PlacedTree {
    x: number;
    layer: number;
  }

  /**
   * Get minimum spacing for a layer (near trees need more room)
   * Interpolates from far (tight spacing) to near (wide spacing)
   */
  function getMinSpacing(layer: number, canvasWidth: number): number {
    const placement = getPlacementConstants(placementConfig);
    // Interpolate: layer 0 uses far spacing, layer NUM_LAYERS-1 uses near spacing
    const t = layer / (NUM_LAYERS - 1);
    const farSpacing = placement.MIN_SPACING.far;
    const nearSpacing = placement.MIN_SPACING.near;
    const spacing = farSpacing + (nearSpacing - farSpacing) * t;
    return canvasWidth * spacing;
  }

  /**
   * Check if a position would collide with already-placed trees
   * Enforces both same-layer spacing and cross-layer separation
   */
  function hasCollision(
    x: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): boolean {
    const placement = getPlacementConstants(placementConfig);
    const minSpacing = getMinSpacing(layer, canvasWidth);
    const crossThreshold = canvasWidth * placement.CROSS_LAYER_THRESHOLD;

    for (const placed of placedTrees) {
      const distance = Math.abs(x - placed.x);

      // Same layer: enforce layer-specific minimum spacing
      if (placed.layer === layer) {
        if (distance < minSpacing) return true;
      }
      // Cross-layer: near trees shouldn't stack directly on far trees
      else if (layer > placed.layer) {
        if (distance < crossThreshold) return true;
      }
    }
    return false;
  }

  /**
   * Try to find a valid position by nudging left/right from ideal
   * Returns null if no valid position found within MAX_NUDGE
   */
  function findValidPosition(
    idealX: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): number | null {
    const placement = getPlacementConstants(placementConfig);

    // Try ideal position first
    if (!hasCollision(idealX, layer, placedTrees, canvasWidth)) {
      return idealX;
    }

    const nudgeStep = canvasWidth * placement.NUDGE_STEP;
    const maxNudge = canvasWidth * placement.MAX_NUDGE;
    const minX = canvasWidth * placement.EDGE_MARGIN;
    const maxX = canvasWidth * (1 - placement.EDGE_MARGIN);

    // Alternate between nudging right and left
    for (let nudge = nudgeStep; nudge <= maxNudge; nudge += nudgeStep) {
      // Try right
      const rightX = idealX + nudge;
      if (rightX <= maxX && !hasCollision(rightX, layer, placedTrees, canvasWidth)) {
        return rightX;
      }

      // Try left
      const leftX = idealX - nudge;
      if (leftX >= minX && !hasCollision(leftX, layer, placedTrees, canvasWidth)) {
        return leftX;
      }
    }

    // Couldn't find valid position - skip this tree
    return null;
  }

  /**
   * Find nearest hero anchor to a position (if within snap distance)
   */
  function getNearestHeroAnchor(
    x: number,
    canvasWidth: number,
    usedAnchors: Set<number>
  ): number | null {
    const placement = getPlacementConstants(placementConfig);

    // If hero strength is 0, disable hero snapping entirely
    if (placementConfig.heroStrength === 0) return null;

    const snapDistance = canvasWidth * placement.HERO_SNAP_DISTANCE;

    for (const anchor of placement.HERO_ANCHORS) {
      const anchorX = canvasWidth * anchor;
      if (!usedAnchors.has(anchor) && Math.abs(x - anchorX) < snapDistance) {
        return anchor;
      }
    }
    return null;
  }

  // ===================
  // TREE GENERATION
  // ===================

  function createTrees(dimensions: Dimensions): Tree[] {
    const trees: Tree[] = [];
    const { width, height } = dimensions;
    const enabledTypes = getEnabledTypes();

    if (enabledTypes.length === 0) return trees;

    // Reset seed for deterministic generation
    resetSeed();

    // Debug: Log which pattern is being used
    const pattern = getCurrentPattern();
    console.log(`[TreeSilhouetteSystem] Creating trees with pattern: "${pattern.name}" (${pattern.id})`);
    console.log(`[TreeSilhouetteSystem] Enabled types:`, enabledTypes);

    // Track placed trees for collision detection
    const placedTrees: PlacedTree[] = [];

    // Track which hero anchors have been used
    const usedHeroAnchors = new Set<number>();

    // Generate trees layer by layer (far to near)
    LAYER_CONFIGS.forEach((layerConfig, layerIndex) => {
      const { columns, heightPresets, widthRange } = layerConfig;
      const [minWidth, maxWidth] = widthRange;

      columns.forEach((column, i) => {
        const placement = getPlacementConstants(placementConfig);

        // Get ideal position from grid
        let idealX = getColumnX(column, width);
        let heightBoost = 1;

        // For mid-to-near layers (second half), check for hero anchor snapping
        if (layerIndex >= Math.floor(NUM_LAYERS / 2)) {
          const heroAnchor = getNearestHeroAnchor(idealX, width, usedHeroAnchors);
          if (heroAnchor !== null) {
            // Snap to hero position and mark as used
            idealX = width * heroAnchor;
            usedHeroAnchors.add(heroAnchor);
            heightBoost = placement.HERO_HEIGHT_BOOST;
          }
        }

        // Find valid position with collision avoidance
        const finalX = findValidPosition(idealX, layerIndex, placedTrees, width);

        // Skip tree if no valid position found
        if (finalX === null) return;

        // Pick tree type based on position and ecological pattern
        const normalizedX = finalX / width;
        const treeType = pickTypeForPosition(normalizedX, enabledTypes);
        const typeScale = TREE_TYPE_SCALES[treeType];

        // Calculate height with species scaling and variation
        const baseHeight = heightPresets[i] ?? heightPresets[0]!;
        const heightVariation = baseHeight * 0.05 * (seededRandom() - 0.5);
        // Apply species height scale (interpolate between min/max based on random)
        const speciesHeightScale = typeScale.heightMin + seededRandom() * (typeScale.heightMax - typeScale.heightMin);
        const finalHeight = height * (baseHeight + heightVariation) * heightBoost * speciesHeightScale;

        // Calculate width with species scaling
        const baseWidth = minWidth + seededRandom() * (maxWidth - minWidth);
        const speciesWidthScale = typeScale.widthMin + seededRandom() * (typeScale.widthMax - typeScale.widthMin);
        const finalWidth = height * baseWidth * speciesWidthScale;

        trees.push({
          x: finalX,
          height: finalHeight,
          width: finalWidth,
          type: treeType,
          layer: layerIndex,
          seed: finalX * 1000 + layerIndex, // Deterministic seed based on position
        });

        // Track for collision detection
        placedTrees.push({ x: finalX, layer: layerIndex });
      });
    });

    // Debug: Log tree type distribution
    const typeCounts: Record<string, number> = {};
    for (const tree of trees) {
      typeCounts[tree.type] = (typeCounts[tree.type] || 0) + 1;
    }
    console.log(`[TreeSilhouetteSystem] Generated ${trees.length} trees:`, typeCounts);

    // Sort by layer first (far layers draw first), then by height within layer
    return trees.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.height - b.height;
    });
  }

  function initialize(dimensions: Dimensions): void {
    // Start image preloading in the background
    if (!imagesLoaded) {
      imageLoader.preload().then(() => {
        imagesLoaded = true;
        console.log('[TreeSilhouetteSystem] Images loaded, re-rendering with image-based trees');
        // Re-render with images now that they're loaded
        if (cachedDimensions) {
          renderToCache(cachedDimensions);
        }
      });
    }
    renderToCache(dimensions);
  }

  /**
   * Preload tree images (call before first render for best experience)
   */
  async function preloadImages(): Promise<void> {
    await imageLoader.preload();
    imagesLoaded = true;
  }

  /**
   * Get silhouette color for a tree based on its layer depth
   * Most trees stay dark; only the very farthest get subtle atmospheric lift
   */
  function getTreeColors(layer: number): { silhouette: RGB } {
    // Interpolate based on layer position (0 = farthest, NUM_LAYERS-1 = nearest)
    const t = layer / (NUM_LAYERS - 1);
    // Ease-out curve: trees get dark quickly, only far layers stay light
    // t^0.4 makes mid-layers much darker while preserving the far->near gradient
    const easedT = Math.pow(t, 0.4);
    return {
      silhouette: lerpColor(FAR_SILHOUETTE, NEAR_SILHOUETTE, easedT),
    };
  }

  /**
   * Get the ground/base Y position for a given layer
   * Far trees sit BELOW the visible horizon (not exactly on it - looks unrealistic)
   * Near trees extend below the viewport (we only see their upper portions)
   */
  function getLayerBaseY(layer: number, height: number): number {
    // Far trees (layer 0): base at ~82% down (below horizon at 78%, so they stand on ground)
    // Near trees (layer 6): base at 101% (extends below viewport)
    const farBaseRatio = 0.82;   // Far trees slightly below horizon
    const nearBaseRatio = 1.01;  // Near trees extend below screen

    const t = layer / (NUM_LAYERS - 1);
    // Ease-out curve so the depth effect is more pronounced for far layers
    const easedT = 1 - Math.pow(1 - t, 1.5);
    const baseRatio = farBaseRatio + (nearBaseRatio - farBaseRatio) * easedT;

    return height * baseRatio;
  }

  function renderToCache(dimensions: Dimensions): void {
    cachedDimensions = dimensions;

    // Clear used images tracker for fresh scene
    usedImages.clear();

    const trees = createTrees(dimensions);

    // Create separate canvas for each layer
    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Get the ground line for this layer (far = higher up, near = below viewport)
      const layerBaseY = getLayerBaseY(layer, dimensions.height);

      // Draw only trees in this layer
      const layerTrees = trees.filter((t) => t.layer === layer);
      for (const tree of layerTrees) {
        // Draw tree using pre-loaded silhouette image
        drawTreeImage(
          ctx,
          tree.x,
          layerBaseY,
          tree.width,
          tree.height,
          tree.type,
          tree.layer,
          tree.seed
        );
      }

      layerCanvases[layer] = canvas;
    }
  }

  /**
   * Draw all tree layers at once (backwards compatibility)
   */
  function draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!layerCanvases[0] || !cachedDimensions) {
      initialize(dimensions);
    }

    // Draw all layers in order
    for (const canvas of layerCanvases) {
      if (canvas) {
        ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
      }
    }
  }

  /**
   * Draw a specific tree layer (for interleaving with grass)
   * @param layer 0 = far, 1 = mid, 2 = near
   */
  function drawLayer(ctx: CanvasRenderingContext2D, dimensions: Dimensions, layer: number): void {
    if (!layerCanvases[0] || !cachedDimensions) {
      initialize(dimensions);
    }

    const canvas = layerCanvases[layer];
    if (canvas) {
      ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
    }
  }

  function handleResize(
    _oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    initialize(newDimensions);
  }

  function setTreeVisibility(visibility: Partial<TreeTypeVisibility>): void {
    currentVisibility = { ...currentVisibility, ...visibility };
  }

  function getTreeVisibility(): TreeTypeVisibility {
    return { ...currentVisibility };
  }

  function regenerate(dimensions: Dimensions): void {
    renderToCache(dimensions);
  }

  function cleanup(): void {
    layerCanvases = Array(NUM_LAYERS).fill(null);
    cachedDimensions = null;
  }

  // Placement config accessors
  function setPlacementConfig(config: Partial<PlacementConfig>): void {
    placementConfig = { ...placementConfig, ...config };
  }

  function getPlacementConfig(): PlacementConfig {
    return { ...placementConfig };
  }

  function resetPlacementConfig(): void {
    placementConfig = { ...DEFAULT_PLACEMENT };
  }

  // ===================
  // ECOLOGICAL PATTERN API
  // ===================

  /**
   * Set the ecological pattern by ID
   */
  function setEcologicalPattern(patternId: string): void {
    const pattern = ECOLOGICAL_PATTERNS.find(p => p.id === patternId);
    if (pattern) {
      currentPatternId = patternId;
    }
  }

  /**
   * Get the current ecological pattern ID
   */
  function getEcologicalPatternId(): string {
    return currentPatternId;
  }

  /**
   * Get the current ecological pattern details
   */
  function getEcologicalPattern(): EcologicalPattern {
    return getCurrentPattern();
  }

  /**
   * Get all available ecological patterns
   */
  function getAvailablePatterns(): EcologicalPattern[] {
    return [...ECOLOGICAL_PATTERNS];
  }

  /**
   * Set a random ecological pattern (excluding "random" itself)
   */
  function setRandomEcologicalPattern(): string {
    const nonRandomPatterns = ECOLOGICAL_PATTERNS.filter(p => p.id !== "random");
    const randomPattern = nonRandomPatterns[Math.floor(Math.random() * nonRandomPatterns.length)]!;
    currentPatternId = randomPattern.id;
    return randomPattern.id;
  }

  return {
    initialize,
    preloadImages,
    draw,
    drawLayer,
    handleResize,
    setTreeVisibility,
    getTreeVisibility,
    setPlacementConfig,
    getPlacementConfig,
    resetPlacementConfig,
    // Ecological pattern API
    setEcologicalPattern,
    getEcologicalPatternId,
    getEcologicalPattern,
    getAvailablePatterns,
    setRandomEcologicalPattern,
    regenerate,
    cleanup,
  };
}
