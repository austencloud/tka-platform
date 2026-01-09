/**
 * Bare Tree Generator
 *
 * Generates dead/winter tree silhouettes with exposed branch structure.
 * No foliage - just the skeletal framework of branches.
 *
 * Uses recursive branching with decreasing probability and thickness,
 * combined with noise-based variation for organic appearance.
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export type BareTreeType = "dead" | "winter-oak" | "birch" | "willow";

export interface BareBranch {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  depth: number; // 0 = trunk, higher = smaller branches
}

export interface GeneratedBareTree {
  branches: BareBranch[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  trunkBase: { x: number; y: number };
  type: BareTreeType;
}

export interface BareTreeConfig {
  type: BareTreeType;
  height: number;
  trunkThickness: number;

  // Branching structure
  maxDepth: number; // How many levels of branching
  branchProbability: number; // Chance of branching at each point (0-1)
  branchAngleRange: number; // Radians, how spread out branches can be
  branchLengthRatio: number; // Each level is this fraction of parent
  branchThicknessRatio: number; // Each level is this fraction of parent thickness

  // Variation
  gnarliness: number; // 0-1, how twisted branches are
  asymmetry: number; // 0-1, how unbalanced the tree is
  droop: number; // 0-1, how much branches droop downward
  brokenBranches: number; // 0-1, probability of truncated/broken branches

  // Dead tree specific
  leanAngle: number; // Radians, how much the whole tree leans
  crookedness: number; // 0-1, trunk irregularity
}

const TYPE_PRESETS: Record<BareTreeType, Partial<BareTreeConfig>> = {
  dead: {
    maxDepth: 5,
    branchProbability: 0.7,
    branchAngleRange: Math.PI * 0.4,
    branchLengthRatio: 0.7,
    branchThicknessRatio: 0.65,
    gnarliness: 0.5,
    asymmetry: 0.4,
    droop: 0.1,
    brokenBranches: 0.3,
    leanAngle: 0.15,
    crookedness: 0.4,
  },
  "winter-oak": {
    maxDepth: 6,
    branchProbability: 0.85,
    branchAngleRange: Math.PI * 0.35,
    branchLengthRatio: 0.65,
    branchThicknessRatio: 0.7,
    gnarliness: 0.35,
    asymmetry: 0.25,
    droop: 0.05,
    brokenBranches: 0.05,
    leanAngle: 0.05,
    crookedness: 0.2,
  },
  birch: {
    maxDepth: 7,
    branchProbability: 0.75,
    branchAngleRange: Math.PI * 0.25,
    branchLengthRatio: 0.75,
    branchThicknessRatio: 0.55,
    gnarliness: 0.15,
    asymmetry: 0.15,
    droop: 0.15,
    brokenBranches: 0.02,
    leanAngle: 0.08,
    crookedness: 0.1,
  },
  willow: {
    maxDepth: 6,
    branchProbability: 0.8,
    branchAngleRange: Math.PI * 0.3,
    branchLengthRatio: 0.7,
    branchThicknessRatio: 0.6,
    gnarliness: 0.25,
    asymmetry: 0.3,
    droop: 0.5, // Willows droop significantly
    brokenBranches: 0.02,
    leanAngle: 0.1,
    crookedness: 0.15,
  },
};

const DEFAULT_CONFIG: BareTreeConfig = {
  type: "dead",
  height: 120,
  trunkThickness: 10,
  maxDepth: 5,
  branchProbability: 0.75,
  branchAngleRange: Math.PI * 0.35,
  branchLengthRatio: 0.7,
  branchThicknessRatio: 0.65,
  gnarliness: 0.3,
  asymmetry: 0.3,
  droop: 0.1,
  brokenBranches: 0.15,
  leanAngle: 0.1,
  crookedness: 0.25,
};

export class BareTree {
  private config: BareTreeConfig;
  private noise: PerlinNoise;
  private branches: BareBranch[] = [];
  private noiseOffset: number;

  constructor(config: Partial<BareTreeConfig> = {}, seed?: number) {
    const typePreset = config.type ? TYPE_PRESETS[config.type] : {};
    this.config = { ...DEFAULT_CONFIG, ...typePreset, ...config };
    this.noise = new PerlinNoise(seed);
    this.noiseOffset = (seed ?? Math.random() * 1000) * 0.01;
  }

  generate(baseX: number, baseY: number): GeneratedBareTree {
    this.branches = [];

    // Generate the tree recursively starting from trunk
    this.generateBranch(
      baseX,
      baseY,
      -Math.PI / 2 + this.config.leanAngle, // Base angle (up, with lean)
      this.config.height,
      this.config.trunkThickness,
      0 // Depth 0 = trunk
    );

    // Calculate bounds
    const bounds = this.calculateBounds();

    return {
      branches: [...this.branches],
      bounds,
      trunkBase: { x: baseX, y: baseY },
      type: this.config.type,
    };
  }

  private generateBranch(
    startX: number,
    startY: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number
  ): void {
    const {
      maxDepth,
      branchProbability,
      branchAngleRange,
      branchLengthRatio,
      branchThicknessRatio,
      gnarliness,
      asymmetry,
      droop,
      brokenBranches,
      crookedness,
    } = this.config;

    // Stop if too deep or too thin
    if (depth > maxDepth || thickness < 0.5 || length < 3) {
      return;
    }

    // Check for broken branch (more likely at higher depths)
    if (depth > 1 && Math.random() < brokenBranches * (depth / maxDepth)) {
      // Truncate this branch - make it shorter and stop
      length *= 0.3 + Math.random() * 0.3;
    }

    // Apply crookedness to angle (more for trunk)
    const crookNoise =
      this.noise.noise2D(startY * 0.05 + this.noiseOffset, depth) *
      crookedness *
      0.3 *
      (1 - depth / maxDepth);
    angle += crookNoise;

    // Calculate segments for this branch (more segments for thicker branches)
    const segments = Math.max(2, Math.ceil(thickness * 0.8));
    const segmentLength = length / segments;

    let currentX = startX;
    let currentY = startY;
    let currentAngle = angle;
    let currentThickness = thickness;

    // Draw segments of this branch
    for (let seg = 0; seg < segments; seg++) {
      // Apply gnarliness variation to angle per segment
      const segmentNoise =
        this.noise.noise2D(
          currentX * 0.02 + this.noiseOffset,
          currentY * 0.02 + seg * 0.5
        ) *
        gnarliness *
        0.4;
      currentAngle += segmentNoise;

      // Apply droop (accumulates along branch)
      currentAngle += (droop * 0.1 * (seg + 1)) / segments;

      // Calculate end point
      const endX = currentX + Math.cos(currentAngle) * segmentLength;
      const endY = currentY + Math.sin(currentAngle) * segmentLength;

      // Taper thickness
      const segmentThickness = currentThickness * (1 - (seg / segments) * 0.3);

      this.branches.push({
        startX: currentX,
        startY: currentY,
        endX,
        endY,
        thickness: segmentThickness,
        depth,
      });

      // Possibly spawn sub-branches from this segment
      if (depth < maxDepth && seg > 0) {
        // Adjusted probability based on position and randomness
        const spawnProbability =
          branchProbability * (0.5 + (seg / segments) * 0.5);

        // Left branch
        if (Math.random() < spawnProbability * (0.8 + asymmetry * 0.4)) {
          const branchAngle =
            currentAngle -
            branchAngleRange * (0.3 + Math.random() * 0.7) +
            this.noise.noise2D(currentX * 0.1, currentY * 0.1) * asymmetry * 0.5;

          this.generateBranch(
            currentX,
            currentY,
            branchAngle,
            length * branchLengthRatio * (0.7 + Math.random() * 0.3),
            segmentThickness * branchThicknessRatio,
            depth + 1
          );
        }

        // Right branch (with asymmetry making one side more likely)
        if (Math.random() < spawnProbability * (0.8 - asymmetry * 0.3)) {
          const branchAngle =
            currentAngle +
            branchAngleRange * (0.3 + Math.random() * 0.7) +
            this.noise.noise2D(currentX * 0.1 + 50, currentY * 0.1) *
              asymmetry *
              0.5;

          this.generateBranch(
            currentX,
            currentY,
            branchAngle,
            length * branchLengthRatio * (0.7 + Math.random() * 0.3),
            segmentThickness * branchThicknessRatio,
            depth + 1
          );
        }
      }

      currentX = endX;
      currentY = endY;
    }
  }

  private calculateBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (this.branches.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const branch of this.branches) {
      const halfThick = branch.thickness / 2;

      minX = Math.min(minX, branch.startX - halfThick, branch.endX - halfThick);
      maxX = Math.max(maxX, branch.startX + halfThick, branch.endX + halfThick);
      minY = Math.min(minY, branch.startY - halfThick, branch.endY - halfThick);
      maxY = Math.max(maxY, branch.startY + halfThick, branch.endY + halfThick);
    }

    return { minX, maxX, minY, maxY };
  }
}

/**
 * Create a randomized bare tree configuration
 */
export function createRandomBareTreeConfig(
  type: BareTreeType,
  scale: number = 1,
  seed?: number
): Partial<BareTreeConfig> {
  const noise = new PerlinNoise(seed);
  const r = (base: number, variance: number) =>
    base + noise.noise2D(base * 0.1, seed ?? 0) * variance;

  const preset = TYPE_PRESETS[type];

  return {
    type,
    height: r(100, 50) * scale,
    trunkThickness: r(8, 4) * scale,
    gnarliness: r(preset.gnarliness ?? 0.3, 0.2),
    asymmetry: r(preset.asymmetry ?? 0.3, 0.2),
    droop: r(preset.droop ?? 0.1, 0.1),
    brokenBranches: r(preset.brokenBranches ?? 0.15, 0.1),
    leanAngle: r(preset.leanAngle ?? 0.1, 0.1),
    crookedness: r(preset.crookedness ?? 0.25, 0.15),
  };
}
