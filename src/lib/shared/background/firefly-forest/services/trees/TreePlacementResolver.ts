/**
 * Tree Placement Resolver
 *
 * Handles grid-based tree placement with collision detection,
 * cross-layer separation, and compositional hero anchors.
 */

import type {
  PlacementConfig,
  PlacementConstants,
  PlacedTree,
} from "../../domain/models/tree-silhouette-models";
import {
  NUM_LAYERS,
  NUM_COLUMNS,
  DEFAULT_PLACEMENT,
} from "../../domain/constants/tree-silhouette-constants";

export interface ITreePlacementResolver {
  /** Get placement constants derived from current config */
  getPlacementConstants(): PlacementConstants;

  /** Get the current placement config */
  getPlacementConfig(): PlacementConfig;

  /** Update placement configuration */
  setPlacementConfig(config: Partial<PlacementConfig>): void;

  /** Reset placement config to defaults */
  resetPlacementConfig(): void;

  /** Get x position for a grid column with jitter */
  getColumnX(column: number, canvasWidth: number): number;

  /** Get minimum spacing for a layer (near trees need more room) */
  getMinSpacing(layer: number, canvasWidth: number): number;

  /** Check if a position would collide with already-placed trees */
  hasCollision(
    x: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): boolean;

  /** Find a valid position by nudging from ideal, returns null if none found */
  findValidPosition(
    idealX: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): number | null;

  /** Find nearest hero anchor to a position (if within snap distance) */
  getNearestHeroAnchor(
    x: number,
    canvasWidth: number,
    usedAnchors: Set<number>
  ): number | null;

  /** Reset the seeded random generator */
  resetSeed(): void;
}

export function createTreePlacementResolver(): ITreePlacementResolver {
  let placementConfig: PlacementConfig = { ...DEFAULT_PLACEMENT };
  let seed = Date.now();

  function seededRandom(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function resetSeed(): void {
    seed = Date.now();
  }

  function getPlacementConstants(): PlacementConstants {
    return {
      HERO_ANCHORS: [0.333, 0.667],
      MIN_SPACING: {
        far: placementConfig.minSpacing,
        mid: placementConfig.minSpacing * 1.5,
        near: placementConfig.minSpacing * 2.25,
      },
      CROSS_LAYER_THRESHOLD: placementConfig.crossLayerThreshold,
      NUDGE_STEP: 0.015,
      MAX_NUDGE: 0.12,
      EDGE_MARGIN: 0.04,
      HERO_HEIGHT_BOOST: 1.08,
      HERO_SNAP_DISTANCE: 0.12 * placementConfig.heroStrength,
      JITTER: placementConfig.jitter,
    };
  }

  function getPlacementConfig(): PlacementConfig {
    return { ...placementConfig };
  }

  function setPlacementConfig(config: Partial<PlacementConfig>): void {
    placementConfig = { ...placementConfig, ...config };
  }

  function resetPlacementConfig(): void {
    placementConfig = { ...DEFAULT_PLACEMENT };
  }

  function getColumnX(column: number, canvasWidth: number): number {
    const constants = getPlacementConstants();
    const margin = canvasWidth * constants.EDGE_MARGIN;
    const usableWidth = canvasWidth - margin * 2;
    const columnWidth = usableWidth / NUM_COLUMNS;
    // Center of column + jitter (scaled by config)
    const jitterAmount =
      (seededRandom() - 0.5) * columnWidth * constants.JITTER;
    return margin + columnWidth * (column + 0.5) + jitterAmount;
  }

  function getMinSpacing(layer: number, canvasWidth: number): number {
    const constants = getPlacementConstants();
    // Interpolate: layer 0 uses far spacing, layer NUM_LAYERS-1 uses near spacing
    const t = layer / (NUM_LAYERS - 1);
    const farSpacing = constants.MIN_SPACING.far;
    const nearSpacing = constants.MIN_SPACING.near;
    const spacing = farSpacing + (nearSpacing - farSpacing) * t;
    return canvasWidth * spacing;
  }

  function hasCollision(
    x: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): boolean {
    const constants = getPlacementConstants();
    const minSpacing = getMinSpacing(layer, canvasWidth);
    const crossThreshold = canvasWidth * constants.CROSS_LAYER_THRESHOLD;

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

  function findValidPosition(
    idealX: number,
    layer: number,
    placedTrees: PlacedTree[],
    canvasWidth: number
  ): number | null {
    const constants = getPlacementConstants();

    // Try ideal position first
    if (!hasCollision(idealX, layer, placedTrees, canvasWidth)) {
      return idealX;
    }

    const nudgeStep = canvasWidth * constants.NUDGE_STEP;
    const maxNudge = canvasWidth * constants.MAX_NUDGE;
    const minX = canvasWidth * constants.EDGE_MARGIN;
    const maxX = canvasWidth * (1 - constants.EDGE_MARGIN);

    // Alternate between nudging right and left
    for (let nudge = nudgeStep; nudge <= maxNudge; nudge += nudgeStep) {
      // Try right
      const rightX = idealX + nudge;
      if (
        rightX <= maxX &&
        !hasCollision(rightX, layer, placedTrees, canvasWidth)
      ) {
        return rightX;
      }

      // Try left
      const leftX = idealX - nudge;
      if (
        leftX >= minX &&
        !hasCollision(leftX, layer, placedTrees, canvasWidth)
      ) {
        return leftX;
      }
    }

    // Couldn't find valid position - skip this tree
    return null;
  }

  function getNearestHeroAnchor(
    x: number,
    canvasWidth: number,
    usedAnchors: Set<number>
  ): number | null {
    const constants = getPlacementConstants();

    // If hero strength is 0, disable hero snapping entirely
    if (placementConfig.heroStrength === 0) return null;

    const snapDistance = canvasWidth * constants.HERO_SNAP_DISTANCE;

    for (const anchor of constants.HERO_ANCHORS) {
      const anchorX = canvasWidth * anchor;
      if (!usedAnchors.has(anchor) && Math.abs(x - anchorX) < snapDistance) {
        return anchor;
      }
    }
    return null;
  }

  return {
    getPlacementConstants,
    getPlacementConfig,
    setPlacementConfig,
    resetPlacementConfig,
    getColumnX,
    getMinSpacing,
    hasCollision,
    findValidPosition,
    getNearestHeroAnchor,
    resetSeed,
  };
}
