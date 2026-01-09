/**
 * Parallax Forest Composer
 *
 * Orchestrates multiple depth layers of trees with parallax scrolling,
 * atmospheric fog, and natural tree distribution.
 *
 * Creates immersive depth through:
 * - 4-6 depth layers from far to near
 * - Size/opacity scaling with depth
 * - Parallax movement rates
 * - Atmospheric fog integration
 */

import { PerlinNoise } from "../noise/PerlinNoise";
import {
  SpaceColonizationTree,
  type GeneratedTree,
  type SpaceColonizationConfig,
} from "../trees/SpaceColonizationTree";
import {
  StochasticConiferTree,
  type GeneratedConifer,
  type ConiferConfig,
  type ConiferType,
} from "../trees/StochasticConiferTree";
import { BareTree, type GeneratedBareTree, type BareTreeConfig, type BareTreeType } from "../trees/BareTree";

export type TreeType = "deciduous" | "conifer" | "bare";

export interface ForestTreeInstance {
  id: string;
  x: number;
  baseY: number; // Ground level
  scale: number;
  depth: number; // 0 = far, 1 = near
  layerIndex: number;
  treeType: TreeType;
  subType: string; // e.g., "pine", "oak", "dead"
  generatedData: GeneratedTree | GeneratedConifer | GeneratedBareTree;
  opacity: number;
  parallaxOffset: number; // Current parallax X offset
}

export interface ForestLayer {
  index: number;
  depth: number; // 0-1, 0 = farthest
  treeCount: number;
  trees: ForestTreeInstance[];
  parallaxFactor: number; // How fast this layer moves (far = slow)
  scale: number; // Base scale for trees in this layer
  opacity: number; // Atmospheric fade
  yOffset: number; // Vertical position of ground line
  fogColor: string;
  fogOpacity: number;
}

export interface ParallaxForestConfig {
  // Canvas dimensions
  width: number;
  height: number;

  // Layer configuration
  layerCount: number;
  treesPerLayer: number[];
  layerDepths: number[]; // 0-1 for each layer

  // Tree distribution
  treeSpacing: number; // Minimum horizontal spacing
  heightVariation: number; // Vertical placement variation
  groundLineY: number; // Base ground level (0-1 of canvas height)

  // Tree type distribution (percentages)
  coniferRatio: number; // 0-1
  deciduousRatio: number; // 0-1
  bareRatio: number; // 0-1

  // Parallax
  parallaxRange: number; // Max parallax offset in pixels
  parallaxSmoothing: number; // How smoothly parallax responds (0-1)

  // Atmosphere
  fogNearColor: string;
  fogFarColor: string;
  fogDensity: number; // 0-1

  // Scale
  nearScale: number;
  farScale: number;
}

const DEFAULT_CONFIG: ParallaxForestConfig = {
  width: 1920,
  height: 1080,
  layerCount: 5,
  treesPerLayer: [8, 10, 12, 14, 10],
  layerDepths: [0, 0.25, 0.5, 0.75, 1],
  treeSpacing: 80,
  heightVariation: 30,
  groundLineY: 0.9,
  coniferRatio: 0.4,
  deciduousRatio: 0.45,
  bareRatio: 0.15,
  parallaxRange: 100,
  parallaxSmoothing: 0.15,
  fogNearColor: "#1a2a35",
  fogFarColor: "#0d1a24",
  fogDensity: 0.7,
  nearScale: 1.2,
  farScale: 0.3,
};

export class ParallaxForestComposer {
  private config: ParallaxForestConfig;
  private noise: PerlinNoise;
  private layers: ForestLayer[] = [];
  private treeIdCounter = 0;

  // Cached generators
  private deciduousGenerator: SpaceColonizationTree;
  private coniferGenerators: Map<ConiferType, StochasticConiferTree> = new Map();
  private bareGenerators: Map<BareTreeType, BareTree> = new Map();

  constructor(config: Partial<ParallaxForestConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);

    // Initialize generators
    this.deciduousGenerator = new SpaceColonizationTree({}, seed);

    const coniferTypes: ConiferType[] = ["pine", "fir", "spruce", "cedar"];
    coniferTypes.forEach((type, i) => {
      this.coniferGenerators.set(type, new StochasticConiferTree({ type }, (seed ?? 0) + i * 100));
    });

    const bareTypes: BareTreeType[] = ["dead", "winter-oak", "birch", "willow"];
    bareTypes.forEach((type, i) => {
      this.bareGenerators.set(type, new BareTree({ type }, (seed ?? 0) + i * 200));
    });
  }

  /**
   * Generate all forest layers and trees
   */
  generate(): ForestLayer[] {
    this.layers = [];
    this.treeIdCounter = 0;

    const { layerCount, treesPerLayer, layerDepths } = this.config;

    for (let i = 0; i < layerCount; i++) {
      const depth = layerDepths[i] ?? i / (layerCount - 1);
      const treeCount = treesPerLayer[i] ?? Math.floor(8 + i * 2);

      const layer = this.generateLayer(i, depth, treeCount);
      this.layers.push(layer);
    }

    return this.layers;
  }

  private generateLayer(index: number, depth: number, treeCount: number): ForestLayer {
    const { width, height, groundLineY, nearScale, farScale, fogNearColor, fogFarColor, fogDensity } =
      this.config;

    // Calculate layer properties based on depth
    const scale = farScale + (nearScale - farScale) * depth;
    const opacity = 0.3 + depth * 0.7; // Far layers more transparent
    const parallaxFactor = 0.2 + depth * 0.8; // Far layers move slower
    const yOffset = groundLineY * height + (1 - depth) * 50; // Far layers slightly higher

    // Fog properties
    const fogOpacity = fogDensity * (1 - depth);

    const layer: ForestLayer = {
      index,
      depth,
      treeCount,
      trees: [],
      parallaxFactor,
      scale,
      opacity,
      yOffset,
      fogColor: this.lerpColor(fogFarColor, fogNearColor, depth),
      fogOpacity,
    };

    // Generate trees for this layer
    layer.trees = this.generateTreesForLayer(layer, treeCount);

    return layer;
  }

  private generateTreesForLayer(layer: ForestLayer, count: number): ForestTreeInstance[] {
    const trees: ForestTreeInstance[] = [];
    const { width, treeSpacing, heightVariation, coniferRatio, deciduousRatio } = this.config;

    // Calculate horizontal positions with noise-based distribution
    const positions = this.distributeTreePositions(count, width, treeSpacing, layer.index);

    for (let i = 0; i < count; i++) {
      const x = positions[i]!;
      const heightOffset =
        this.noise.noise2D(x * 0.01 + layer.index * 10, i) * heightVariation * layer.scale;

      // Determine tree type based on ratios
      const typeRoll = this.noise.noise2D(x * 0.05, i * 0.5 + layer.index * 100);
      const normalizedRoll = (typeRoll + 1) / 2;

      let treeType: TreeType;
      let subType: string;

      if (normalizedRoll < coniferRatio) {
        treeType = "conifer";
        const types: ConiferType[] = ["pine", "fir", "spruce", "cedar"];
        subType = types[Math.floor(Math.abs(this.noise.noise2D(x, i) * types.length)) % types.length]!;
      } else if (normalizedRoll < coniferRatio + deciduousRatio) {
        treeType = "deciduous";
        subType = "oak"; // Space colonization is naturally oak-like
      } else {
        treeType = "bare";
        const types: BareTreeType[] = ["dead", "winter-oak", "birch", "willow"];
        subType = types[Math.floor(Math.abs(this.noise.noise2D(x * 2, i) * types.length)) % types.length]!;
      }

      // Generate the tree
      const tree = this.generateTree(
        this.treeIdCounter++,
        x,
        layer.yOffset + heightOffset,
        layer.scale * (0.8 + Math.random() * 0.4),
        layer.depth,
        layer.index,
        treeType,
        subType
      );

      trees.push(tree);
    }

    // Sort by y position for proper overlap
    trees.sort((a, b) => a.baseY - b.baseY);

    return trees;
  }

  private generateTree(
    id: number,
    x: number,
    baseY: number,
    scale: number,
    depth: number,
    layerIndex: number,
    treeType: TreeType,
    subType: string
  ): ForestTreeInstance {
    let generatedData: GeneratedTree | GeneratedConifer | GeneratedBareTree;

    // Generate based on type
    switch (treeType) {
      case "deciduous":
        generatedData = this.deciduousGenerator.generate(0, 0);
        break;
      case "conifer":
        const coniferGen = this.coniferGenerators.get(subType as ConiferType);
        generatedData = coniferGen
          ? coniferGen.generate(0, 0)
          : this.coniferGenerators.get("pine")!.generate(0, 0);
        break;
      case "bare":
        const bareGen = this.bareGenerators.get(subType as BareTreeType);
        generatedData = bareGen ? bareGen.generate(0, 0) : this.bareGenerators.get("dead")!.generate(0, 0);
        break;
    }

    return {
      id: `tree-${id}`,
      x,
      baseY,
      scale,
      depth,
      layerIndex,
      treeType,
      subType,
      generatedData,
      opacity: 0.5 + depth * 0.5,
      parallaxOffset: 0,
    };
  }

  private distributeTreePositions(
    count: number,
    width: number,
    minSpacing: number,
    layerSeed: number
  ): number[] {
    const positions: number[] = [];
    const attemptLimit = count * 10;
    let attempts = 0;

    // Add some trees off-screen for parallax scrolling
    const extendedWidth = width * 1.4;
    const offsetX = -width * 0.2;

    while (positions.length < count && attempts < attemptLimit) {
      // Noise-based position with some randomness
      const baseX =
        (this.noise.noise2D(attempts * 0.3 + layerSeed, positions.length) + 1) /
        2 *
        extendedWidth +
        offsetX;

      // Check spacing from existing positions
      const tooClose = positions.some((px) => Math.abs(px - baseX) < minSpacing);

      if (!tooClose) {
        positions.push(baseX);
      }

      attempts++;
    }

    // Fill remaining with evenly distributed positions
    while (positions.length < count) {
      positions.push(offsetX + (positions.length / count) * extendedWidth);
    }

    return positions.sort((a, b) => a - b);
  }

  /**
   * Update parallax positions based on input value
   * @param parallaxValue -1 to 1, typically from mouse/tilt
   */
  updateParallax(parallaxValue: number): void {
    const { parallaxRange, parallaxSmoothing } = this.config;

    for (const layer of this.layers) {
      const targetOffset = parallaxValue * parallaxRange * layer.parallaxFactor;

      for (const tree of layer.trees) {
        // Smooth interpolation
        tree.parallaxOffset += (targetOffset - tree.parallaxOffset) * parallaxSmoothing;
      }
    }
  }

  /**
   * Get all layers in order (far to near)
   */
  getLayers(): ForestLayer[] {
    return [...this.layers].sort((a, b) => a.depth - b.depth);
  }

  /**
   * Get all trees across all layers, sorted for rendering
   */
  getAllTreesSorted(): ForestTreeInstance[] {
    const allTrees: ForestTreeInstance[] = [];

    for (const layer of this.layers) {
      allTrees.push(...layer.trees);
    }

    // Sort by depth (far first), then by Y position
    return allTrees.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.baseY - b.baseY;
    });
  }

  /**
   * Regenerate trees in a specific layer
   */
  regenerateLayer(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (layer) {
      layer.trees = this.generateTreesForLayer(layer, layer.treeCount);
    }
  }

  /**
   * Update canvas dimensions and regenerate
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.generate();
  }

  /**
   * Get fog properties for a specific depth
   */
  getFogAtDepth(depth: number): { color: string; opacity: number } {
    const { fogNearColor, fogFarColor, fogDensity } = this.config;
    return {
      color: this.lerpColor(fogFarColor, fogNearColor, depth),
      opacity: fogDensity * (1 - depth),
    };
  }

  private lerpColor(color1: string, color2: string, t: number): string {
    // Parse hex colors
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    if (!c1 || !c2) return color1;

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  getConfig(): ParallaxForestConfig {
    return { ...this.config };
  }

  getStats(): {
    layerCount: number;
    totalTrees: number;
    treesByType: Record<TreeType, number>;
  } {
    let totalTrees = 0;
    const treesByType: Record<TreeType, number> = {
      deciduous: 0,
      conifer: 0,
      bare: 0,
    };

    for (const layer of this.layers) {
      totalTrees += layer.trees.length;
      for (const tree of layer.trees) {
        treesByType[tree.treeType]++;
      }
    }

    return {
      layerCount: this.layers.length,
      totalTrees,
      treesByType,
    };
  }
}
