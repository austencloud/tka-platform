import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";

export type TreeType = "pine" | "fir" | "spruce" | "oak" | "maple" | "poplar";

export interface TreeTypeVisibility {
  pine: boolean;
  fir: boolean;
  spruce: boolean;
  oak: boolean;
  maple: boolean;
  poplar: boolean;
}

interface Tree {
  x: number;
  height: number;
  width: number;
  type: TreeType;
  layer: number; // 0 = far, 1 = mid, 2 = near
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
const LAYER_CONFIGS: LayerConfig[] = [
  // Far layer (small trees) - denser, fills gaps
  {
    columns: [0, 1.5, 3, 4.5, 6, 7.5, 9],
    heightPresets: [0.20, 0.24, 0.18, 0.22, 0.25, 0.19, 0.21],
    widthRange: [0.05, 0.07],
  },
  // Mid layer - offset from far layer
  {
    columns: [0.5, 2, 3.5, 5, 6.5, 8, 9.5],
    heightPresets: [0.35, 0.40, 0.32, 0.42, 0.38, 0.36, 0.34],
    widthRange: [0.08, 0.11],
  },
  // Foreground layer - fewer but strategic placement
  {
    columns: [0, 2.5, 5, 7.5, 10],
    heightPresets: [0.52, 0.58, 0.48, 0.55, 0.50],
    widthRange: [0.12, 0.16],
  },
];

const NUM_COLUMNS = 10;

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
  let layerCanvases: (OffscreenCanvas | null)[] = [null, null, null];
  let cachedDimensions: Dimensions | null = null;
  let currentVisibility: TreeTypeVisibility = {
    pine: true,
    fir: true,
    spruce: true,
    oak: true,
    maple: true,
    poplar: true,
  };

  // Configurable placement parameters
  let placementConfig: PlacementConfig = { ...DEFAULT_PLACEMENT };

  type RenderContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  // Night silhouette color palette
  // All layers are DARK silhouettes - far trees are slightly lighter (atmospheric haze)
  // but still read as dark shapes against the lighter sky
  // Colors use gradual green-to-dark progression to avoid stark gray appearance on far trees
  const FAR_FOLIAGE = { r: 8, g: 16, b: 12 }; // Distant green haze - still reads as forest
  const MID_FOLIAGE = { r: 5, g: 10, b: 8 }; // Darker with green tint
  const NEAR_FOLIAGE = { r: 2, g: 4, b: 3 }; // Near-black (true silhouette)

  // Trunks should contrast with foliage at all depths
  const FAR_TRUNK = { r: 18, g: 14, b: 12 }; // Visible brown, lighter than far foliage
  const MID_TRUNK = { r: 10, g: 8, b: 6 }; // Dark brown
  const NEAR_TRUNK = { r: 4, g: 3, b: 2 }; // Very dark brown

  // Rim light color - subtle moonlight edge glow (reduced intensity)
  const RIM_LIGHT = { r: 30, g: 40, b: 50 }; // Subtle blue moonlight

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

  /** Adjust brightness of an RGB color (factor > 1 = lighter, < 1 = darker) */
  function adjustBrightness(color: RGB, factor: number): RGB {
    return {
      r: Math.min(255, Math.floor(color.r * factor)),
      g: Math.min(255, Math.floor(color.g * factor)),
      b: Math.min(255, Math.floor(color.b * factor)),
    };
  }

  /** Convert RGB to CSS string */
  function rgbToString(color: RGB, alpha = 1): string {
    if (alpha < 1) {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  /** Create a radial gradient for tree foliage */
  function createFoliageGradient(
    ctx: RenderContext,
    x: number,
    centerY: number,
    radius: number,
    baseColor: RGB
  ): CanvasGradient {
    const gradient = ctx.createRadialGradient(x, centerY, 0, x, centerY, radius);
    // Subtle gradient for silhouettes - slightly lighter center, darker edges
    // Keep it subtle so trees read as solid dark shapes
    const lighter = adjustBrightness(baseColor, 1.15); // Center: 15% lighter
    const darker = adjustBrightness(baseColor, 0.85); // Edge: 15% darker

    gradient.addColorStop(0, rgbToString(lighter));
    gradient.addColorStop(0.6, rgbToString(baseColor));
    gradient.addColorStop(1, rgbToString(darker));

    return gradient;
  }

  /**
   * Apply rim lighting to current path
   * Simulates moonlight catching the edges of tree silhouettes
   * @param layer - 0 (far) to 2 (near), affects rim intensity
   * @param treeHeight - used to scale line width appropriately
   */
  function applyRimLight(ctx: RenderContext, layer: number, treeHeight: number): void {
    // Rim intensity: far trees get more rim (atmospheric haze), near trees get subtle rim
    // This creates depth - far trees appear hazier/lighter at edges
    const baseOpacity = 0.35 - layer * 0.1; // 0.35 for far, 0.15 for near
    const lineWidth = Math.max(1, treeHeight * 0.005 * (1.4 - layer * 0.15));

    ctx.strokeStyle = rgbToString(RIM_LIGHT, baseOpacity);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
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
  // CONIFER TREES
  // ===================

  /**
   * Pine tree - classic layered Christmas tree shape
   */
  function drawPine(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.14;
    const trunkH = height * 0.2;
    const bodyStart = baseY - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Draw foliage with radial gradient
    const foliageCenterY = baseY - height * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, height * 0.6, foliageColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.45, bodyStart);
    ctx.lineTo(x - width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x - width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x - width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x - width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x - width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x + width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x + width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x + width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x + width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x + width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x + width * 0.45, bodyStart);
    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
  }

  /**
   * Fir tree - dense triangular shape with subtle texture
   */
  function drawFir(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.18;
    const bodyStart = baseY - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Draw foliage with radial gradient
    const foliageCenterY = baseY - height * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, height * 0.6, foliageColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.48, bodyStart);
    ctx.lineTo(x - width * 0.42, bodyStart - height * 0.12);
    ctx.lineTo(x - width * 0.44, bodyStart - height * 0.15);
    ctx.lineTo(x - width * 0.36, bodyStart - height * 0.3);
    ctx.lineTo(x - width * 0.38, bodyStart - height * 0.33);
    ctx.lineTo(x - width * 0.28, bodyStart - height * 0.5);
    ctx.lineTo(x - width * 0.3, bodyStart - height * 0.53);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.72);
    ctx.lineTo(x - width * 0.12, bodyStart - height * 0.78);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.12, bodyStart - height * 0.78);
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.72);
    ctx.lineTo(x + width * 0.3, bodyStart - height * 0.53);
    ctx.lineTo(x + width * 0.28, bodyStart - height * 0.5);
    ctx.lineTo(x + width * 0.38, bodyStart - height * 0.33);
    ctx.lineTo(x + width * 0.36, bodyStart - height * 0.3);
    ctx.lineTo(x + width * 0.44, bodyStart - height * 0.15);
    ctx.lineTo(x + width * 0.42, bodyStart - height * 0.12);
    ctx.lineTo(x + width * 0.48, bodyStart);
    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
  }

  /**
   * Spruce - tall and narrow conifer with algorithmic variation
   * Each tree gets unique but symmetrical branch pattern based on position
   */
  function drawSpruce(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.16;
    const trunkH = height * 0.15;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Create position-based seed for this specific tree
    const treeSeed = Math.floor(x * 1000 + layer * 10000);
    let localSeed = treeSeed;
    const treeRandom = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Generate 4-6 tiers with variation
    const tierCount = 4 + Math.floor(treeRandom() * 3); // 4-6 tiers

    // Generate tier parameters with variation (symmetric left/right)
    interface SpruceLayer {
      heightRatio: number; // 0-1, position up the tree
      outerWidth: number;  // Branch tip width
      innerWidth: number;  // Indent after branch
    }

    const tiers: SpruceLayer[] = [];

    // Base width at bottom, narrowing toward top
    const baseWidthRatio = 0.32 + treeRandom() * 0.08; // 0.32-0.40
    const tipNarrowness = 0.06 + treeRandom() * 0.04;  // 0.06-0.10 at very top

    for (let i = 0; i < tierCount; i++) {
      const t = i / tierCount;

      // Height position with slight variation
      const baseHeight = t * 0.85; // Leave room for pointy tip
      const heightJitter = (treeRandom() - 0.5) * 0.04;
      const heightRatio = Math.min(0.88, baseHeight + heightJitter);

      // Width tapers from base to top (exponential curve looks more natural)
      const taper = 1 - Math.pow(t, 0.7);
      const tierBaseWidth = tipNarrowness + (baseWidthRatio - tipNarrowness) * taper;

      // Add width variation per tier (±15%)
      const widthVariation = 1 + (treeRandom() - 0.5) * 0.3;
      const outerWidth = tierBaseWidth * widthVariation;

      // Inner indent is narrower (creates the layered look)
      const indentRatio = 0.6 + treeRandom() * 0.2; // 60-80% of outer
      const innerWidth = outerWidth * indentRatio;

      tiers.push({ heightRatio, outerWidth, innerWidth });
    }

    // Draw foliage with radial gradient
    const foliageCenterY = baseY - height * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, height * 0.6, foliageColor);
    ctx.fillStyle = gradient;

    ctx.beginPath();

    // Start at bottom left
    ctx.moveTo(x - width * baseWidthRatio, bodyStart);

    // Draw left side going up (tiers create the layered silhouette)
    for (const tier of tiers) {
      const tierY = bodyStart - bodyHeight * tier.heightRatio;
      const nextTierY = tierY - bodyHeight * 0.03; // Small step up for indent

      // Branch tip (outer)
      ctx.lineTo(x - width * tier.innerWidth, tierY);
      // Indent back toward trunk
      ctx.lineTo(x - width * tier.outerWidth, nextTierY);
    }

    // Pointy tip at the very top (always sharp)
    const tipApproachY = bodyStart - bodyHeight * 0.92;
    const tipApproachWidth = tipNarrowness * 0.5;
    ctx.lineTo(x - width * tipApproachWidth, tipApproachY);
    ctx.lineTo(x, baseY - height); // Sharp tip at apex

    // Right side going down (mirror of left)
    ctx.lineTo(x + width * tipApproachWidth, tipApproachY);

    // Draw right side going down (reverse order)
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i]!;
      const tierY = bodyStart - bodyHeight * tier.heightRatio;
      const nextTierY = tierY - bodyHeight * 0.03;

      // Indent (outer)
      ctx.lineTo(x + width * tier.outerWidth, nextTierY);
      // Branch tip (inner)
      ctx.lineTo(x + width * tier.innerWidth, tierY);
    }

    // Back to bottom right
    ctx.lineTo(x + width * baseWidthRatio, bodyStart);

    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
  }

  // ===================
  // DECIDUOUS TREES
  // ===================

  /**
   * Oak tree - rounded, full crown
   */
  function drawOak(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.18;
    const trunkH = height * 0.35;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Draw foliage with radial gradient
    const foliageCenterY = crownStart - crownHeight * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, crownHeight * 0.6, foliageColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.35, crownStart);
    ctx.quadraticCurveTo(
      x - width * 0.5,
      crownStart - crownHeight * 0.2,
      x - width * 0.48,
      crownStart - crownHeight * 0.4
    );
    ctx.quadraticCurveTo(
      x - width * 0.52,
      crownStart - crownHeight * 0.6,
      x - width * 0.4,
      crownStart - crownHeight * 0.75
    );
    ctx.quadraticCurveTo(
      x - width * 0.3,
      crownStart - crownHeight * 0.95,
      x - width * 0.15,
      crownStart - crownHeight * 0.98
    );
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.05, x + width * 0.15, crownStart - crownHeight * 0.98);
    ctx.quadraticCurveTo(
      x + width * 0.3,
      crownStart - crownHeight * 0.95,
      x + width * 0.4,
      crownStart - crownHeight * 0.75
    );
    ctx.quadraticCurveTo(
      x + width * 0.52,
      crownStart - crownHeight * 0.6,
      x + width * 0.48,
      crownStart - crownHeight * 0.4
    );
    ctx.quadraticCurveTo(
      x + width * 0.5,
      crownStart - crownHeight * 0.2,
      x + width * 0.35,
      crownStart
    );
    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
  }

  /**
   * Maple tree - wide spreading crown with lobed silhouette
   */
  function drawMaple(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.3;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Draw foliage with radial gradient
    const foliageCenterY = crownStart - crownHeight * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, crownHeight * 0.6, foliageColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.25, crownStart);
    ctx.quadraticCurveTo(x - width * 0.55, crownStart - crownHeight * 0.1, x - width * 0.5, crownStart - crownHeight * 0.3);
    ctx.lineTo(x - width * 0.55, crownStart - crownHeight * 0.35);
    ctx.quadraticCurveTo(x - width * 0.5, crownStart - crownHeight * 0.5, x - width * 0.45, crownStart - crownHeight * 0.55);
    ctx.lineTo(x - width * 0.48, crownStart - crownHeight * 0.6);
    ctx.quadraticCurveTo(x - width * 0.4, crownStart - crownHeight * 0.8, x - width * 0.25, crownStart - crownHeight * 0.9);
    ctx.lineTo(x - width * 0.2, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.02, x + width * 0.2, crownStart - crownHeight * 0.95);
    ctx.lineTo(x + width * 0.25, crownStart - crownHeight * 0.9);
    ctx.quadraticCurveTo(x + width * 0.4, crownStart - crownHeight * 0.8, x + width * 0.48, crownStart - crownHeight * 0.6);
    ctx.lineTo(x + width * 0.45, crownStart - crownHeight * 0.55);
    ctx.quadraticCurveTo(x + width * 0.5, crownStart - crownHeight * 0.5, x + width * 0.55, crownStart - crownHeight * 0.35);
    ctx.lineTo(x + width * 0.5, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x + width * 0.55, crownStart - crownHeight * 0.1, x + width * 0.25, crownStart);
    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
  }

  /**
   * Poplar tree - tall columnar deciduous
   */
  function drawPoplar(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: RGB,
    foliageColor: RGB,
    layer: number
  ): void {
    const trunkW = width * 0.2;
    const trunkH = height * 0.25;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Draw trunk first
    ctx.fillStyle = rgbToString(trunkColor);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Draw foliage with radial gradient
    const foliageCenterY = crownStart - crownHeight * 0.5;
    const gradient = createFoliageGradient(ctx, x, foliageCenterY, crownHeight * 0.6, foliageColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.25, crownStart);
    ctx.quadraticCurveTo(x - width * 0.35, crownStart - crownHeight * 0.15, x - width * 0.3, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x - width * 0.32, crownStart - crownHeight * 0.5, x - width * 0.25, crownStart - crownHeight * 0.7);
    ctx.quadraticCurveTo(x - width * 0.2, crownStart - crownHeight * 0.85, x - width * 0.1, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.02, x + width * 0.1, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x + width * 0.2, crownStart - crownHeight * 0.85, x + width * 0.25, crownStart - crownHeight * 0.7);
    ctx.quadraticCurveTo(x + width * 0.32, crownStart - crownHeight * 0.5, x + width * 0.3, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x + width * 0.35, crownStart - crownHeight * 0.15, x + width * 0.25, crownStart);
    ctx.closePath();
    ctx.fill();
    applyRimLight(ctx, layer, height);
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
   */
  function getMinSpacing(layer: number, canvasWidth: number): number {
    const placement = getPlacementConstants(placementConfig);
    const spacings = [
      placement.MIN_SPACING.far,
      placement.MIN_SPACING.mid,
      placement.MIN_SPACING.near,
    ];
    return canvasWidth * (spacings[layer] ?? spacings[0]!);
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

    const pickType = (): TreeType =>
      enabledTypes[Math.floor(seededRandom() * enabledTypes.length)]!;

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

        // For mid and near layers, check for hero anchor snapping
        if (layerIndex >= 1) {
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

        // Calculate height with variation and potential hero boost
        const baseHeight = heightPresets[i] ?? heightPresets[0]!;
        const heightVariation = baseHeight * 0.05 * (seededRandom() - 0.5);
        const finalHeight = height * (baseHeight + heightVariation) * heightBoost;

        trees.push({
          x: finalX,
          height: finalHeight,
          width: height * (minWidth + seededRandom() * (maxWidth - minWidth)),
          type: pickType(),
          layer: layerIndex,
        });

        // Track for collision detection
        placedTrees.push({ x: finalX, layer: layerIndex });
      });
    });

    // Sort by layer first (far layers draw first), then by height within layer
    return trees.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.height - b.height;
    });
  }

  function initialize(dimensions: Dimensions): void {
    renderToCache(dimensions);
  }

  /**
   * Get colors for a tree based on its layer depth
   * Uses distinct colors per layer for clear depth separation
   */
  function getTreeColors(layer: number): { trunk: RGB; foliage: RGB } {
    // Use distinct colors per layer for maximum depth perception
    switch (layer) {
      case 0: // Far - lighter, blue-tinted (atmospheric haze)
        return { trunk: FAR_TRUNK, foliage: FAR_FOLIAGE };
      case 1: // Mid - medium dark
        return { trunk: MID_TRUNK, foliage: MID_FOLIAGE };
      case 2: // Near - near-black silhouette
      default:
        return { trunk: NEAR_TRUNK, foliage: NEAR_FOLIAGE };
    }
  }

  function renderToCache(dimensions: Dimensions): void {
    cachedDimensions = dimensions;

    const trees = createTrees(dimensions);
    // Trees sit just at the bottom edge - only 1% below to hide any jagged bottom edges
    const baseY = dimensions.height + dimensions.height * 0.01;

    // Create separate canvas for each layer
    for (let layer = 0; layer < 3; layer++) {
      const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw only trees in this layer
      const layerTrees = trees.filter((t) => t.layer === layer);
      for (const tree of layerTrees) {
        const colors = getTreeColors(tree.layer);

        switch (tree.type) {
          case "pine":
            drawPine(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
          case "fir":
            drawFir(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
          case "spruce":
            drawSpruce(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
          case "oak":
            drawOak(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
          case "maple":
            drawMaple(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
          case "poplar":
            drawPoplar(ctx, tree.x, baseY, tree.width, tree.height, colors.trunk, colors.foliage, tree.layer);
            break;
        }
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
    layerCanvases = [null, null, null];
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

  return {
    initialize,
    draw,
    drawLayer,
    handleResize,
    setTreeVisibility,
    getTreeVisibility,
    setPlacementConfig,
    getPlacementConfig,
    resetPlacementConfig,
    regenerate,
    cleanup,
  };
}
