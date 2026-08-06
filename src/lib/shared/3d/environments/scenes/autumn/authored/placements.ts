export interface RingConfig {
  count: number;
  radius: number;
  radiusJitter: number;
  scaleBase: number;
  scaleVariation: number;
  seed: number;
  centerX?: number;
  centerZ?: number;
  /** Fraction of one placement step used to break up the perfect radial grid. */
  angleJitter?: number;
}

export interface Placement {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export function ringPlacements(cfg: RingConfig): Placement[] {
  return Array.from({ length: cfg.count }, (_, i) => {
    const s = cfg.seed * 100 + i;
    const step = (Math.PI * 2) / cfg.count;
    const angle =
      i * step +
      cfg.seed * 0.4 +
      Math.sin(s * 1.13) * step * (cfg.angleJitter ?? 0);
    const r = cfg.radius + Math.sin(s * 3.7) * cfg.radiusJitter;
    return {
      x: (cfg.centerX ?? 0) + Math.cos(angle) * r,
      z: (cfg.centerZ ?? 0) + Math.sin(angle) * r,
      scale: cfg.scaleBase + Math.abs(Math.sin(s * 2.3) * cfg.scaleVariation),
      rotationY: angle + Math.PI + Math.sin(s * 1.7) * 0.3,
    };
  });
}

export interface AutumnPlacementLayout {
  trees: Placement[];
  mushrooms: Placement[];
  rocks: Placement[];
  logs: Placement[];
  grass: Placement[];
  flowers: Placement[];
  forestEdgeRadius: number;
}

interface AutumnPlacementLayoutOptions {
  treeCount: number;
  mushroomCount: number;
  stageWidth: number;
  stageDepth: number;
  stageZOffset: number;
}

function splitCount(total: number, weights: readonly number[]): number[] {
  let remaining = total;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return remaining;
    const count = Math.round(total * weight);
    remaining -= count;
    return count;
  });
}

/**
 * Builds the Autumn set dressing around the actual performer footprint.
 * Keeping every ring centered on the stage matters when multiple performers
 * expand the stage toward negative Z: otherwise the forest cuts through the
 * back half of the choreography space.
 */
export function createAutumnPlacementLayout({
  treeCount,
  mushroomCount,
  stageWidth,
  stageDepth,
  stageZOffset,
}: AutumnPlacementLayoutOptions): AutumnPlacementLayout {
  const stageRadius = Math.hypot(stageWidth * 0.5, stageDepth * 0.5);
  const forestEdgeRadius = Math.max(12, stageRadius + 5.5);
  const detailEdgeRadius = Math.max(6.5, stageRadius + 2.25);
  const centered = { centerZ: stageZOffset, angleJitter: 0.38 } as const;

  const [innerTrees, middleTrees, outerTrees] = splitCount(
    treeCount,
    [0.34, 0.36, 0.3]
  );
  const [innerMushrooms, outerMushrooms] = splitCount(
    mushroomCount,
    [0.58, 0.42]
  );

  return {
    trees: [
      ...ringPlacements({
        count: innerTrees!,
        radius: forestEdgeRadius,
        radiusJitter: 1.25,
        scaleBase: 2.45,
        scaleVariation: 0.45,
        seed: 1,
        ...centered,
      }),
      ...ringPlacements({
        count: middleTrees!,
        radius: forestEdgeRadius + 4.75,
        radiusJitter: 1.8,
        scaleBase: 2.7,
        scaleVariation: 0.5,
        seed: 2,
        ...centered,
      }),
      ...ringPlacements({
        count: outerTrees!,
        radius: forestEdgeRadius + 10,
        radiusJitter: 2.35,
        scaleBase: 2.9,
        scaleVariation: 0.55,
        seed: 3,
        ...centered,
      }),
    ],
    mushrooms: [
      ...ringPlacements({
        count: innerMushrooms!,
        radius: detailEdgeRadius,
        radiusJitter: 1.1,
        scaleBase: 0.52,
        scaleVariation: 0.22,
        seed: 11,
        ...centered,
      }),
      ...ringPlacements({
        count: outerMushrooms!,
        radius: detailEdgeRadius + 2.4,
        radiusJitter: 1.35,
        scaleBase: 0.45,
        scaleVariation: 0.2,
        seed: 12,
        ...centered,
      }),
    ],
    rocks: ringPlacements({
      count: Math.max(6, Math.round(treeCount * 0.24)),
      radius: detailEdgeRadius + 0.4,
      radiusJitter: 1.6,
      scaleBase: 0.34,
      scaleVariation: 0.24,
      seed: 21,
      ...centered,
    }),
    logs: ringPlacements({
      count: Math.max(3, Math.round(treeCount * 0.11)),
      radius: detailEdgeRadius + 2.2,
      radiusJitter: 1.4,
      scaleBase: 0.48,
      scaleVariation: 0.2,
      seed: 22,
      ...centered,
    }),
    grass: ringPlacements({
      count: Math.max(8, Math.round(treeCount * 0.35)),
      radius: detailEdgeRadius,
      radiusJitter: 1.9,
      scaleBase: 0.72,
      scaleVariation: 0.35,
      seed: 23,
      ...centered,
    }),
    flowers: ringPlacements({
      count: Math.max(7, Math.round(treeCount * 0.28)),
      radius: detailEdgeRadius - 0.4,
      radiusJitter: 1.45,
      scaleBase: 0.8,
      scaleVariation: 0.32,
      seed: 24,
      ...centered,
    }),
    forestEdgeRadius,
  };
}
