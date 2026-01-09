/**
 * Stochastic Conifer Tree Generator
 *
 * Generates pine, fir, and spruce silhouettes using L-system inspired
 * procedural generation with stochastic (random) variation.
 *
 * Unlike pure L-systems, this uses direct procedural generation with
 * noise-based variation for more control over silhouette shape.
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export type ConiferType = "pine" | "fir" | "spruce" | "cedar";

export interface ConiferBranch {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  level: number; // 0 = trunk, 1 = primary branch, 2 = secondary, etc.
}

export interface ConiferFoliageCluster {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  density: number; // 0-1, affects rendering
}

export interface GeneratedConifer {
  branches: ConiferBranch[];
  foliageClusters: ConiferFoliageCluster[];
  silhouettePoints: Array<{ x: number; y: number }>; // Outline for filled rendering
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  trunkBase: { x: number; y: number };
  type: ConiferType;
}

export interface ConiferConfig {
  type: ConiferType;
  height: number;
  baseWidth: number; // Width at bottom of crown
  topWidth: number; // Width at top (usually small/pointed)

  // Trunk
  trunkHeight: number; // Visible trunk below crown
  trunkThickness: number;

  // Branching
  branchLayers: number; // Number of whorl layers
  branchesPerLayer: number; // Branches per whorl (randomized)
  branchAngle: number; // Base angle from trunk (radians)
  branchDroop: number; // How much branches droop (0-1)
  branchLengthVariation: number; // Random variation in branch length

  // Variation
  asymmetry: number; // How asymmetric the tree is (0-1)
  gnarliness: number; // Twist in branches (0-1)
  layerSpacingVariation: number; // Variation in vertical spacing

  // Foliage
  foliageDensity: number; // How full the foliage looks
  foliageClumpiness: number; // How clumped vs even the foliage is
}

const TYPE_PRESETS: Record<ConiferType, Partial<ConiferConfig>> = {
  pine: {
    branchLayers: 6,
    branchesPerLayer: 5,
    branchAngle: Math.PI * 0.35,
    branchDroop: 0.15,
    branchLengthVariation: 0.3,
    asymmetry: 0.25,
    gnarliness: 0.2,
    foliageDensity: 0.7,
    foliageClumpiness: 0.6,
  },
  fir: {
    branchLayers: 10,
    branchesPerLayer: 6,
    branchAngle: Math.PI * 0.4,
    branchDroop: 0.05,
    branchLengthVariation: 0.15,
    asymmetry: 0.1,
    gnarliness: 0.1,
    foliageDensity: 0.9,
    foliageClumpiness: 0.3,
  },
  spruce: {
    branchLayers: 12,
    branchesPerLayer: 5,
    branchAngle: Math.PI * 0.3,
    branchDroop: 0.25,
    branchLengthVariation: 0.2,
    asymmetry: 0.15,
    gnarliness: 0.15,
    foliageDensity: 0.85,
    foliageClumpiness: 0.4,
  },
  cedar: {
    branchLayers: 8,
    branchesPerLayer: 4,
    branchAngle: Math.PI * 0.45,
    branchDroop: 0.3,
    branchLengthVariation: 0.35,
    asymmetry: 0.3,
    gnarliness: 0.25,
    foliageDensity: 0.6,
    foliageClumpiness: 0.7,
  },
};

const DEFAULT_CONFIG: ConiferConfig = {
  type: "pine",
  height: 150,
  baseWidth: 80,
  topWidth: 5,
  trunkHeight: 30,
  trunkThickness: 8,
  branchLayers: 8,
  branchesPerLayer: 5,
  branchAngle: Math.PI * 0.35,
  branchDroop: 0.15,
  branchLengthVariation: 0.25,
  asymmetry: 0.2,
  gnarliness: 0.2,
  layerSpacingVariation: 0.2,
  foliageDensity: 0.8,
  foliageClumpiness: 0.5,
};

export class StochasticConiferTree {
  private config: ConiferConfig;
  private noise: PerlinNoise;

  constructor(config: Partial<ConiferConfig> = {}, seed?: number) {
    // Merge type preset with provided config
    const typePreset = config.type ? TYPE_PRESETS[config.type] : {};
    this.config = { ...DEFAULT_CONFIG, ...typePreset, ...config };
    this.noise = new PerlinNoise(seed);
  }

  generate(baseX: number, baseY: number): GeneratedConifer {
    const branches: ConiferBranch[] = [];
    const foliageClusters: ConiferFoliageCluster[] = [];
    const silhouettePoints: Array<{ x: number; y: number }> = [];

    // Generate trunk
    this.generateTrunk(branches, baseX, baseY);

    // Generate branch layers from bottom to top
    this.generateBranchLayers(branches, foliageClusters, baseX, baseY);

    // Generate silhouette outline
    this.generateSilhouette(silhouettePoints, baseX, baseY);

    // Calculate bounds
    const bounds = this.calculateBounds(silhouettePoints);

    return {
      branches,
      foliageClusters,
      silhouettePoints,
      bounds,
      trunkBase: { x: baseX, y: baseY },
      type: this.config.type,
    };
  }

  private generateTrunk(branches: ConiferBranch[], baseX: number, baseY: number): void {
    const { trunkHeight, trunkThickness, gnarliness, height } = this.config;
    const totalHeight = trunkHeight + height;
    const segments = Math.ceil(totalHeight / 15);

    let currentX = baseX;
    let currentY = baseY;
    const segmentHeight = totalHeight / segments;

    for (let i = 0; i < segments; i++) {
      // Slight wobble for gnarliness
      const wobble = this.noise.noise2D(i * 0.3, baseX * 0.01) * gnarliness * 5;
      const nextX = currentX + wobble;
      const nextY = currentY - segmentHeight;

      // Trunk tapers toward top
      const progress = i / segments;
      const thickness = trunkThickness * (1 - progress * 0.7);

      branches.push({
        startX: currentX,
        startY: currentY,
        endX: nextX,
        endY: nextY,
        thickness,
        level: 0,
      });

      currentX = nextX;
      currentY = nextY;
    }
  }

  private generateBranchLayers(
    branches: ConiferBranch[],
    foliageClusters: ConiferFoliageCluster[],
    baseX: number,
    baseY: number
  ): void {
    const {
      height,
      trunkHeight,
      baseWidth,
      topWidth,
      branchLayers,
      branchesPerLayer,
      branchAngle,
      branchDroop,
      branchLengthVariation,
      asymmetry,
      gnarliness,
      layerSpacingVariation,
      foliageDensity,
    } = this.config;

    const crownStart = baseY - trunkHeight;
    const crownHeight = height;
    const baseLayerSpacing = crownHeight / branchLayers;

    for (let layer = 0; layer < branchLayers; layer++) {
      // Vertical position with variation
      const layerProgress = layer / (branchLayers - 1);
      const spacingVariation =
        1 + this.noise.noise2D(layer, baseX * 0.01) * layerSpacingVariation;
      const layerY = crownStart - layer * baseLayerSpacing * spacingVariation;

      // Width at this height (interpolate between base and top)
      const layerWidth = baseWidth * (1 - layerProgress) + topWidth * layerProgress;

      // Number of branches varies
      const numBranches =
        branchesPerLayer +
        Math.floor(this.noise.noise2D(layer * 2, 0) * 2) -
        Math.floor(layerProgress * 2);

      // Generate branches around the trunk
      for (let b = 0; b < Math.max(2, numBranches); b++) {
        // Angle around trunk (with asymmetry)
        const baseAngle = (b / numBranches) * Math.PI * 2;
        const asymmetryOffset = this.noise.noise2D(layer, b) * asymmetry * Math.PI * 0.3;
        const horizontalAngle = baseAngle + asymmetryOffset;

        // For 2D silhouette, we only care about left/right projection
        const sideProjection = Math.sin(horizontalAngle);

        // Branch length with variation
        const baseBranchLength = layerWidth * 0.5;
        const lengthVariation =
          1 + this.noise.noise2D(layer * 10 + b, 0) * branchLengthVariation;
        const branchLength = baseBranchLength * lengthVariation;

        // Branch start (on trunk)
        const trunkWobble = this.noise.noise2D(layerY * 0.1, 0) * gnarliness * 3;
        const startX = baseX + trunkWobble;
        const startY = layerY;

        // Branch end with angle and droop
        const droopAmount = branchDroop * branchLength * (1 - layerProgress * 0.5);
        const gnarlOffset =
          this.noise.noise2D(layer * 5 + b * 3, baseX * 0.01) * gnarliness * 10;

        const endX = startX + sideProjection * branchLength + gnarlOffset;
        const endY =
          startY +
          Math.cos(branchAngle) * branchLength * 0.2 + // Slight upward angle
          droopAmount;

        // Branch thickness decreases with height
        const thickness = Math.max(1, (1 - layerProgress) * 3 + 0.5);

        branches.push({
          startX,
          startY,
          endX,
          endY,
          thickness,
          level: 1,
        });

        // Add foliage cluster at branch end
        if (Math.abs(sideProjection) > 0.3) {
          // Only visible branches
          foliageClusters.push({
            x: endX,
            y: endY - 5,
            width: branchLength * 0.4,
            height: branchLength * 0.25,
            angle: Math.atan2(endY - startY, endX - startX),
            density: foliageDensity * (0.7 + Math.random() * 0.3),
          });
        }
      }
    }
  }

  private generateSilhouette(
    points: Array<{ x: number; y: number }>,
    baseX: number,
    baseY: number
  ): void {
    const {
      height,
      trunkHeight,
      baseWidth,
      topWidth,
      asymmetry,
      gnarliness,
      branchLayers,
    } = this.config;

    const crownStart = baseY - trunkHeight;
    const crownTop = crownStart - height;

    // Generate points along the right edge, then left edge
    const pointsPerSide = branchLayers * 2 + 4;

    // Start at trunk base right
    points.push({ x: baseX + 3, y: baseY });
    points.push({ x: baseX + 3, y: crownStart + 10 });

    // Right edge of crown (bottom to top)
    for (let i = 0; i < pointsPerSide; i++) {
      const t = i / (pointsPerSide - 1);
      const y = crownStart - t * height;

      // Base width that tapers
      let width = (baseWidth * (1 - t) + topWidth * t) * 0.5;

      // Add noise for organic edge
      const edgeNoise = this.noise.fbm(t * 5, baseX * 0.02 + 100, 3, 0.5) * 15;
      const asymmetryNoise = this.noise.noise2D(t * 3, 50) * asymmetry * width * 0.3;

      // Sawtooth pattern for branch layers
      const layerIndex = Math.floor(t * branchLayers);
      const layerT = (t * branchLayers) % 1;
      const sawtoothBump = Math.sin(layerT * Math.PI) * 8 * (1 - t);

      width += edgeNoise + asymmetryNoise + sawtoothBump;

      points.push({ x: baseX + Math.max(2, width), y });
    }

    // Top point
    const topNoise = this.noise.noise2D(0, baseX * 0.01) * gnarliness * 5;
    points.push({ x: baseX + topNoise, y: crownTop });

    // Left edge of crown (top to bottom)
    for (let i = pointsPerSide - 1; i >= 0; i--) {
      const t = i / (pointsPerSide - 1);
      const y = crownStart - t * height;

      let width = (baseWidth * (1 - t) + topWidth * t) * 0.5;

      // Different noise offset for asymmetry
      const edgeNoise = this.noise.fbm(t * 5, baseX * 0.02 - 100, 3, 0.5) * 15;
      const asymmetryNoise = this.noise.noise2D(t * 3, -50) * asymmetry * width * 0.3;

      const layerIndex = Math.floor(t * branchLayers);
      const layerT = (t * branchLayers) % 1;
      const sawtoothBump = Math.sin(layerT * Math.PI) * 8 * (1 - t);

      width += edgeNoise - asymmetryNoise + sawtoothBump;

      points.push({ x: baseX - Math.max(2, width), y });
    }

    // Back to trunk base
    points.push({ x: baseX - 3, y: crownStart + 10 });
    points.push({ x: baseX - 3, y: baseY });
  }

  private calculateBounds(
    points: Array<{ x: number; y: number }>
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    return { minX, maxX, minY, maxY };
  }
}

/**
 * Create a randomized conifer configuration
 */
export function createRandomConiferConfig(
  type: ConiferType,
  scale: number = 1,
  seed?: number
): Partial<ConiferConfig> {
  const noise = new PerlinNoise(seed);
  const r = (base: number, variance: number) =>
    base + noise.noise2D(base * 0.1, seed ?? 0) * variance;

  const preset = TYPE_PRESETS[type];

  return {
    type,
    height: r(120, 50) * scale,
    baseWidth: r(60, 25) * scale,
    topWidth: r(4, 2) * scale,
    trunkHeight: r(25, 15) * scale,
    trunkThickness: r(6, 3) * scale,
    asymmetry: r(preset.asymmetry ?? 0.2, 0.15),
    gnarliness: r(preset.gnarliness ?? 0.2, 0.15),
    branchDroop: r(preset.branchDroop ?? 0.15, 0.1),
    foliageDensity: r(preset.foliageDensity ?? 0.8, 0.15),
  };
}
