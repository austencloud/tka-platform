/**
 * Space Colonization Tree Generator
 *
 * Generates organic deciduous tree silhouettes using the space colonization algorithm.
 * Branches grow toward "attractors" placed in a crown volume, creating naturally
 * asymmetric, non-intersecting branching patterns.
 *
 * Based on: "Modeling Trees with a Space Colonization Algorithm"
 * by Runions, Lane, and Prusinkiewicz (University of Calgary)
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export interface TreeBranch {
  x: number;
  y: number;
  parentIndex: number | null;
  thickness: number;
  children: number[];
  growDirection: { x: number; y: number };
}

export interface GeneratedTree {
  branches: TreeBranch[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  trunkBase: { x: number; y: number };
  canopyPoints: Array<{ x: number; y: number }>; // For foliage silhouette
}

export interface SpaceColonizationConfig {
  // Crown shape
  crownWidth: number;
  crownHeight: number;
  crownOffsetY: number; // How high crown starts above trunk

  // Algorithm parameters
  attractorCount: number;
  attractionRadius: number; // How far attractors can influence branches
  killDistance: number; // When branch reaches this close, attractor is removed
  segmentLength: number; // Length of each branch segment
  maxIterations: number;

  // Trunk
  trunkHeight: number;
  trunkSegments: number;

  // Variation
  branchAngleVariation: number; // Radians of random angle variation
  thicknessFalloff: number; // How quickly branches thin out (0-1)
  gnarliness: number; // How twisted branches are (0-1)

  // Tropism (directional bias)
  gravitropism: number; // Tendency to grow up (-) or droop (+)
  phototropism: number; // Tendency to grow toward light (not used for silhouette)
}

const DEFAULT_CONFIG: SpaceColonizationConfig = {
  crownWidth: 120,
  crownHeight: 100,
  crownOffsetY: 40,
  attractorCount: 150,
  attractionRadius: 80,
  killDistance: 8,
  segmentLength: 6,
  maxIterations: 100,
  trunkHeight: 60,
  trunkSegments: 8,
  branchAngleVariation: 0.3,
  thicknessFalloff: 0.7,
  gnarliness: 0.3,
  gravitropism: 0.1,
  phototropism: 0,
};

interface Attractor {
  x: number;
  y: number;
  active: boolean;
}

export class SpaceColonizationTree {
  private config: SpaceColonizationConfig;
  private noise: PerlinNoise;

  constructor(config: Partial<SpaceColonizationConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);
  }

  /**
   * Generate a complete tree
   */
  generate(baseX: number, baseY: number): GeneratedTree {
    const branches: TreeBranch[] = [];
    const attractors: Attractor[] = [];

    // Create trunk
    this.generateTrunk(branches, baseX, baseY);

    // Create attractors in crown volume
    this.generateAttractors(attractors, baseX, baseY);

    // Grow branches toward attractors
    this.growBranches(branches, attractors);

    // Calculate thickness based on branch hierarchy
    this.calculateThickness(branches);

    // Generate canopy points for foliage rendering
    const canopyPoints = this.generateCanopyPoints(branches, attractors);

    // Calculate bounds
    const bounds = this.calculateBounds(branches, canopyPoints);

    return {
      branches,
      bounds,
      trunkBase: { x: baseX, y: baseY },
      canopyPoints,
    };
  }

  private generateTrunk(branches: TreeBranch[], baseX: number, baseY: number): void {
    const { trunkHeight, trunkSegments, gnarliness } = this.config;
    const segmentHeight = trunkHeight / trunkSegments;

    let currentX = baseX;
    let currentY = baseY;

    for (let i = 0; i < trunkSegments; i++) {
      // Add slight gnarly wobble to trunk
      const wobble = this.noise.noise2D(i * 0.5, 0) * gnarliness * 8;

      const branch: TreeBranch = {
        x: currentX + wobble,
        y: currentY,
        parentIndex: i === 0 ? null : i - 1,
        thickness: 1, // Will be calculated later
        children: [],
        growDirection: { x: 0, y: -1 },
      };

      if (i > 0) {
        const prevBranch = branches[i - 1];
        if (prevBranch) prevBranch.children.push(i);
      }

      branches.push(branch);
      currentY -= segmentHeight;
      currentX += wobble * 0.3;
    }
  }

  private generateAttractors(attractors: Attractor[], baseX: number, baseY: number): void {
    const { crownWidth, crownHeight, crownOffsetY, trunkHeight, attractorCount } = this.config;

    const crownCenterX = baseX;
    const crownCenterY = baseY - trunkHeight - crownOffsetY - crownHeight / 2;

    for (let i = 0; i < attractorCount; i++) {
      // Distribute attractors in an elliptical crown shape
      // Use rejection sampling for natural distribution
      let x: number, y: number;
      let attempts = 0;

      do {
        // Random point in bounding box
        x = crownCenterX + (Math.random() - 0.5) * crownWidth;
        y = crownCenterY + (Math.random() - 0.5) * crownHeight;

        // Check if inside ellipse
        const dx = (x - crownCenterX) / (crownWidth / 2);
        const dy = (y - crownCenterY) / (crownHeight / 2);
        attempts++;

        if (dx * dx + dy * dy <= 1) break;
      } while (attempts < 100);

      // Add noise-based displacement for organic shape
      const noiseScale = 0.02;
      x += this.noise.fbm(x * noiseScale, y * noiseScale, 3) * crownWidth * 0.15;
      y += this.noise.fbm(x * noiseScale + 100, y * noiseScale, 3) * crownHeight * 0.1;

      attractors.push({ x, y, active: true });
    }
  }

  private growBranches(branches: TreeBranch[], attractors: Attractor[]): void {
    const { attractionRadius, killDistance, segmentLength, maxIterations } = this.config;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // For each branch tip, find influencing attractors
      const branchInfluences = new Map<number, { x: number; y: number; count: number }>();

      // Only consider branch tips (branches with no children)
      const tips = branches
        .map((b, i) => ({ branch: b, index: i }))
        .filter(({ branch }) => branch.children.length === 0);

      for (const attractor of attractors) {
        if (!attractor.active) continue;

        let closestTip: { index: number; distance: number } | null = null;

        // Find closest branch tip to this attractor
        for (const { branch, index } of tips) {
          const dx = attractor.x - branch.x;
          const dy = attractor.y - branch.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < attractionRadius) {
            if (!closestTip || dist < closestTip.distance) {
              closestTip = { index, distance: dist };
            }
          }
        }

        if (closestTip) {
          // Add this attractor's influence to the closest tip
          const tip = branches[closestTip.index];
          if (!tip) continue;
          const dx = attractor.x - tip.x;
          const dy = attractor.y - tip.y;
          const dist = closestTip.distance;

          const existing = branchInfluences.get(closestTip.index) || { x: 0, y: 0, count: 0 };
          existing.x += dx / dist;
          existing.y += dy / dist;
          existing.count++;
          branchInfluences.set(closestTip.index, existing);

          // Kill attractor if too close
          if (dist < killDistance) {
            attractor.active = false;
          }
        }
      }

      // Grow new branches based on influences
      if (branchInfluences.size === 0) break; // No more growth possible

      for (const [tipIndex, influence] of branchInfluences) {
        const tip = branches[tipIndex];
        if (!tip) continue;

        // Normalize and apply variation
        const len = Math.sqrt(influence.x * influence.x + influence.y * influence.y);
        let dirX = influence.x / len;
        let dirY = influence.y / len;

        // Apply gnarliness (noise-based direction variation)
        const noiseAngle =
          this.noise.noise2D(tip.x * 0.1, tip.y * 0.1) *
          this.config.gnarliness *
          Math.PI *
          0.5;
        const cos = Math.cos(noiseAngle);
        const sin = Math.sin(noiseAngle);
        const newDirX = dirX * cos - dirY * sin;
        const newDirY = dirX * sin + dirY * cos;
        dirX = newDirX;
        dirY = newDirY;

        // Apply gravitropism (droop)
        dirY += this.config.gravitropism;

        // Renormalize
        const newLen = Math.sqrt(dirX * dirX + dirY * dirY);
        dirX /= newLen;
        dirY /= newLen;

        // Create new branch segment
        const newBranch: TreeBranch = {
          x: tip.x + dirX * segmentLength,
          y: tip.y + dirY * segmentLength,
          parentIndex: tipIndex,
          thickness: 1,
          children: [],
          growDirection: { x: dirX, y: dirY },
        };

        const newIndex = branches.length;
        branches.push(newBranch);
        tip.children.push(newIndex);
      }
    }
  }

  private calculateThickness(branches: TreeBranch[]): void {
    // Use pipe model: parent thickness² = sum of children thickness²
    // Work backwards from tips to trunk

    const calculateBranchThickness = (index: number): number => {
      const branch = branches[index];
      if (!branch) return 1;

      if (branch.children.length === 0) {
        // Tip - minimum thickness
        branch.thickness = 1;
        return 1;
      }

      // Sum of children squared
      let sumSquared = 0;
      for (const childIndex of branch.children) {
        const childThickness = calculateBranchThickness(childIndex);
        sumSquared += childThickness * childThickness;
      }

      branch.thickness = Math.sqrt(sumSquared) * this.config.thicknessFalloff + 0.5;
      return branch.thickness;
    };

    // Start from trunk base
    calculateBranchThickness(0);

    // Normalize so trunk is reasonable size
    const trunkBranch = branches[0];
    if (!trunkBranch) return;
    const maxThickness = trunkBranch.thickness;
    const targetMaxThickness = 8;
    const scale = targetMaxThickness / maxThickness;

    for (const branch of branches) {
      branch.thickness = Math.max(0.5, branch.thickness * scale);
    }
  }

  private generateCanopyPoints(
    branches: TreeBranch[],
    attractors: Attractor[]
  ): Array<{ x: number; y: number }> {
    // Use remaining attractors and branch tips to define canopy hull
    const points: Array<{ x: number; y: number }> = [];

    // Add active attractors (edges of canopy)
    for (const attractor of attractors) {
      if (attractor.active) {
        points.push({ x: attractor.x, y: attractor.y });
      }
    }

    // Add branch tips
    for (const branch of branches) {
      if (branch.children.length === 0) {
        points.push({ x: branch.x, y: branch.y });
      }
    }

    return points;
  }

  private calculateBounds(
    branches: TreeBranch[],
    canopyPoints: Array<{ x: number; y: number }>
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const branch of branches) {
      minX = Math.min(minX, branch.x);
      maxX = Math.max(maxX, branch.x);
      minY = Math.min(minY, branch.y);
      maxY = Math.max(maxY, branch.y);
    }

    for (const point of canopyPoints) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }
}

/**
 * Create a randomized deciduous tree configuration
 */
export function createRandomDeciduousConfig(
  scale: number = 1,
  seed?: number
): Partial<SpaceColonizationConfig> {
  const noise = new PerlinNoise(seed);
  const r = (base: number, variance: number) =>
    base + noise.noise2D(base, variance) * variance;

  return {
    crownWidth: r(100, 40) * scale,
    crownHeight: r(80, 30) * scale,
    crownOffsetY: r(30, 15) * scale,
    attractorCount: Math.floor(r(120, 50)),
    attractionRadius: r(70, 20) * scale,
    killDistance: r(8, 3) * scale,
    segmentLength: r(5, 2) * scale,
    trunkHeight: r(50, 20) * scale,
    trunkSegments: Math.floor(r(8, 3)),
    branchAngleVariation: r(0.3, 0.15),
    thicknessFalloff: r(0.7, 0.1),
    gnarliness: r(0.25, 0.2),
    gravitropism: r(0.08, 0.06),
  };
}
