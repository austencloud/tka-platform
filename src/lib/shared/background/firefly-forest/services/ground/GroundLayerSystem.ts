/**
 * Ground Layer System
 *
 * Generates procedural ground vegetation:
 * - Bushes and shrubs
 * - Grass tufts
 * - Ferns and undergrowth
 * - Ground texture variation
 *
 * Creates the forest floor that grounds the tree silhouettes.
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export type GroundElementType = "bush" | "grass" | "fern" | "rock" | "stump";

export interface GroundElement {
  id: string;
  type: GroundElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number; // 0-1 for parallax
  silhouettePoints: Array<{ x: number; y: number }>;
  opacity: number;
}

export interface GrassBlade {
  baseX: number;
  baseY: number;
  tipX: number;
  tipY: number;
  controlX: number; // Bezier control point
  controlY: number;
  thickness: number;
}

export interface GrassTuft {
  id: string;
  x: number;
  y: number;
  depth: number;
  blades: GrassBlade[];
  width: number;
  height: number;
}

export interface GroundLayerConfig {
  // Canvas dimensions
  width: number;
  height: number;
  groundLineY: number; // 0-1 of height

  // Bush configuration
  bushCount: number;
  bushMinSize: number;
  bushMaxSize: number;
  bushNoiseScale: number;
  bushNoiseAmplitude: number;

  // Grass configuration
  grassTuftCount: number;
  bladesPerTuft: number;
  grassMinHeight: number;
  grassMaxHeight: number;
  grassCurvature: number; // 0-1

  // Fern configuration
  fernCount: number;
  fernMinSize: number;
  fernMaxSize: number;
  frondCount: number;

  // Distribution
  clusteringStrength: number; // 0-1, how much elements cluster
  depthLayers: number;
}

const DEFAULT_CONFIG: GroundLayerConfig = {
  width: 1920,
  height: 1080,
  groundLineY: 0.9,
  bushCount: 15,
  bushMinSize: 30,
  bushMaxSize: 80,
  bushNoiseScale: 0.08,
  bushNoiseAmplitude: 12,
  grassTuftCount: 40,
  bladesPerTuft: 8,
  grassMinHeight: 15,
  grassMaxHeight: 40,
  grassCurvature: 0.4,
  fernCount: 10,
  fernMinSize: 20,
  fernMaxSize: 50,
  frondCount: 6,
  clusteringStrength: 0.5,
  depthLayers: 3,
};

export class GroundLayerSystem {
  private config: GroundLayerConfig;
  private noise: PerlinNoise;
  private elements: GroundElement[] = [];
  private grassTufts: GrassTuft[] = [];
  private idCounter = 0;

  constructor(config: Partial<GroundLayerConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);
  }

  /**
   * Generate all ground elements
   */
  generate(): void {
    this.elements = [];
    this.grassTufts = [];
    this.idCounter = 0;

    // Generate in layers from far to near
    for (let layer = 0; layer < this.config.depthLayers; layer++) {
      const depth = layer / (this.config.depthLayers - 1 || 1);
      this.generateLayerElements(depth, layer);
    }

    // Sort by depth and y position
    this.elements.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.y - b.y;
    });
    this.grassTufts.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.y - b.y;
    });
  }

  private generateLayerElements(depth: number, layerIndex: number): void {
    const { bushCount, grassTuftCount, fernCount, depthLayers } = this.config;

    // Scale counts by layer (more elements in near layers)
    const layerMultiplier = 0.5 + depth * 0.5;

    // Generate bushes
    const bushesForLayer = Math.ceil((bushCount / depthLayers) * layerMultiplier);
    for (let i = 0; i < bushesForLayer; i++) {
      this.generateBush(depth, layerIndex, i);
    }

    // Generate grass tufts
    const grassForLayer = Math.ceil((grassTuftCount / depthLayers) * layerMultiplier);
    for (let i = 0; i < grassForLayer; i++) {
      this.generateGrassTuft(depth, layerIndex, i);
    }

    // Generate ferns
    const fernsForLayer = Math.ceil((fernCount / depthLayers) * layerMultiplier);
    for (let i = 0; i < fernsForLayer; i++) {
      this.generateFern(depth, layerIndex, i);
    }
  }

  private generateBush(depth: number, layerIndex: number, index: number): void {
    const {
      width,
      height,
      groundLineY,
      bushMinSize,
      bushMaxSize,
      bushNoiseScale,
      bushNoiseAmplitude,
      clusteringStrength,
    } = this.config;

    const groundY = height * groundLineY;

    // Position with clustering
    const noiseX = this.noise.noise2D(index * 0.5 + layerIndex * 100, depth * 10);
    const clusterX = this.noise.noise2D(index * 0.1, layerIndex) * width * clusteringStrength;
    const x = (noiseX * 0.5 + 0.5) * width * (1 - clusteringStrength) + clusterX;

    // Y position near ground with variation
    const yVariation = this.noise.noise2D(x * 0.01, layerIndex * 50) * 20;
    const y = groundY + yVariation - (1 - depth) * 30; // Far bushes higher

    // Size
    const sizeNoise = (this.noise.noise2D(x * 0.02, y * 0.02) + 1) / 2;
    const bushWidth = bushMinSize + sizeNoise * (bushMaxSize - bushMinSize);
    const bushHeight = bushWidth * (0.6 + Math.random() * 0.4);

    // Generate silhouette points
    const silhouettePoints = this.generateBushSilhouette(
      x,
      y,
      bushWidth,
      bushHeight,
      bushNoiseScale,
      bushNoiseAmplitude
    );

    this.elements.push({
      id: `bush-${this.idCounter++}`,
      type: "bush",
      x,
      y,
      width: bushWidth,
      height: bushHeight,
      depth,
      silhouettePoints,
      opacity: 0.6 + depth * 0.4,
    });
  }

  private generateBushSilhouette(
    centerX: number,
    baseY: number,
    width: number,
    height: number,
    noiseScale: number,
    noiseAmplitude: number
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const pointCount = 24;

    // Generate bumpy dome shape
    for (let i = 0; i <= pointCount; i++) {
      const t = i / pointCount;
      const angle = Math.PI * t; // Half circle (dome)

      // Base dome position
      const baseX = centerX + Math.cos(angle) * (width / 2);
      const baseYPos = baseY - Math.sin(angle) * height;

      // Add noise for organic edge
      const noiseVal =
        this.noise.fbm(baseX * noiseScale, baseYPos * noiseScale, 4) * noiseAmplitude;

      // Additional bumps
      const bumpNoise = this.noise.noise2D(baseX * noiseScale * 3, baseYPos * noiseScale * 3) * 5;

      const dx = baseX - centerX;
      const dy = baseYPos - baseY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      points.push({
        x: baseX + (dx / dist) * (noiseVal + bumpNoise),
        y: baseYPos + (dy / dist) * (noiseVal + bumpNoise) * 0.5,
      });
    }

    // Close at ground level
    points.push({ x: centerX + width / 2 + 5, y: baseY });
    points.push({ x: centerX - width / 2 - 5, y: baseY });

    return points;
  }

  private generateGrassTuft(depth: number, layerIndex: number, index: number): void {
    const {
      width,
      height,
      groundLineY,
      bladesPerTuft,
      grassMinHeight,
      grassMaxHeight,
      grassCurvature,
    } = this.config;

    const groundY = height * groundLineY;

    // Position
    const x = this.noise.noise2D(index * 0.7 + layerIndex * 200, depth * 20);
    const tuftX = (x * 0.5 + 0.5) * width;
    const yVariation = this.noise.noise2D(tuftX * 0.01, layerIndex * 30) * 15;
    const tuftY = groundY + yVariation - (1 - depth) * 20;

    // Generate blades
    const blades: GrassBlade[] = [];
    const tuftWidth = 20 + Math.random() * 30;
    let maxHeight = 0;

    for (let b = 0; b < bladesPerTuft; b++) {
      const bladeT = b / (bladesPerTuft - 1 || 1);
      const bladeX = tuftX - tuftWidth / 2 + bladeT * tuftWidth;

      // Height variation
      const heightNoise = (this.noise.noise2D(bladeX * 0.1, b) + 1) / 2;
      const bladeHeight = grassMinHeight + heightNoise * (grassMaxHeight - grassMinHeight);
      maxHeight = Math.max(maxHeight, bladeHeight);

      // Curvature - lean outward from center
      const leanDirection = (bladeT - 0.5) * 2; // -1 to 1
      const curvatureAmount = grassCurvature * leanDirection * bladeHeight * 0.5;

      // Control point for bezier
      const controlX = bladeX + curvatureAmount;
      const controlY = tuftY - bladeHeight * 0.6;

      blades.push({
        baseX: bladeX,
        baseY: tuftY,
        tipX: bladeX + curvatureAmount * 1.2,
        tipY: tuftY - bladeHeight,
        controlX,
        controlY,
        thickness: 1 + Math.random() * 1.5,
      });
    }

    this.grassTufts.push({
      id: `grass-${this.idCounter++}`,
      x: tuftX,
      y: tuftY,
      depth,
      blades,
      width: tuftWidth,
      height: maxHeight,
    });
  }

  private generateFern(depth: number, layerIndex: number, index: number): void {
    const { width, height, groundLineY, fernMinSize, fernMaxSize, frondCount } = this.config;

    const groundY = height * groundLineY;

    // Position
    const noiseX = this.noise.noise2D(index * 0.6 + layerIndex * 150, depth * 15);
    const x = (noiseX * 0.5 + 0.5) * width;
    const yVariation = this.noise.noise2D(x * 0.01, layerIndex * 40) * 15;
    const y = groundY + yVariation - (1 - depth) * 25;

    // Size
    const sizeNoise = (this.noise.noise2D(x * 0.02, y * 0.02) + 1) / 2;
    const fernSize = fernMinSize + sizeNoise * (fernMaxSize - fernMinSize);

    // Generate fern silhouette
    const silhouettePoints = this.generateFernSilhouette(x, y, fernSize, frondCount);

    this.elements.push({
      id: `fern-${this.idCounter++}`,
      type: "fern",
      x,
      y,
      width: fernSize * 1.5,
      height: fernSize,
      depth,
      silhouettePoints,
      opacity: 0.5 + depth * 0.5,
    });
  }

  private generateFernSilhouette(
    centerX: number,
    baseY: number,
    size: number,
    frondCount: number
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];

    // Start at base center
    points.push({ x: centerX, y: baseY });

    // Generate fronds radiating outward
    for (let f = 0; f < frondCount; f++) {
      const t = f / (frondCount - 1 || 1);
      const angle = -Math.PI * 0.2 + t * Math.PI * 0.4 - Math.PI / 2; // Upward spread

      const frondLength = size * (0.7 + Math.random() * 0.3);
      const midX = centerX + Math.cos(angle) * frondLength * 0.5;
      const midY = baseY + Math.sin(angle) * frondLength * 0.5;
      const tipX = centerX + Math.cos(angle) * frondLength;
      const tipY = baseY + Math.sin(angle) * frondLength;

      // Add leaflets along frond
      const leafletCount = 5;
      for (let l = 0; l < leafletCount; l++) {
        const lt = l / leafletCount;
        const leafX = centerX + (tipX - centerX) * lt;
        const leafY = baseY + (tipY - baseY) * lt;
        const leafSize = (size * 0.15) * (1 - lt * 0.5);

        // Left leaflet
        const leftAngle = angle - Math.PI * 0.35;
        points.push({
          x: leafX + Math.cos(leftAngle) * leafSize,
          y: leafY + Math.sin(leftAngle) * leafSize,
        });

        // Frond center
        points.push({ x: leafX, y: leafY });

        // Right leaflet
        const rightAngle = angle + Math.PI * 0.35;
        points.push({
          x: leafX + Math.cos(rightAngle) * leafSize,
          y: leafY + Math.sin(rightAngle) * leafSize,
        });
      }

      // Frond tip
      points.push({ x: tipX, y: tipY });
    }

    // Return to base
    points.push({ x: centerX, y: baseY });

    return points;
  }

  /**
   * Get all ground elements for rendering
   */
  getElements(): GroundElement[] {
    return this.elements;
  }

  /**
   * Get all grass tufts for rendering
   */
  getGrassTufts(): GrassTuft[] {
    return this.grassTufts;
  }

  /**
   * Get elements by type
   */
  getElementsByType(type: GroundElementType): GroundElement[] {
    return this.elements.filter((e) => e.type === type);
  }

  /**
   * Get elements at a specific depth layer
   */
  getElementsAtDepth(depth: number, tolerance: number = 0.1): GroundElement[] {
    return this.elements.filter((e) => Math.abs(e.depth - depth) < tolerance);
  }

  /**
   * Resize and regenerate
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.generate();
  }

  getConfig(): GroundLayerConfig {
    return { ...this.config };
  }

  getStats(): {
    totalElements: number;
    bushes: number;
    grassTufts: number;
    ferns: number;
    totalBlades: number;
  } {
    const bushes = this.elements.filter((e) => e.type === "bush").length;
    const ferns = this.elements.filter((e) => e.type === "fern").length;
    const totalBlades = this.grassTufts.reduce((sum, tuft) => sum + tuft.blades.length, 0);

    return {
      totalElements: this.elements.length + this.grassTufts.length,
      bushes,
      grassTufts: this.grassTufts.length,
      ferns,
      totalBlades,
    };
  }
}
