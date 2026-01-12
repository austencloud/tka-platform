/**
 * Tree Generator
 *
 * Creates tree instances with proper positioning, sizing, and type selection.
 * Composes TreePlacementResolver and EcologicalPatternProvider for generation.
 */

import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  TreeType,
  TreeTypeVisibility,
  RenderedTree,
  PlacedTree,
} from "../../domain/models/tree-silhouette-models";
import {
  NUM_LAYERS,
  LAYER_CONFIGS,
  TREE_TYPE_SCALES,
} from "../../domain/constants/tree-silhouette-constants";
import type { ITreePlacementResolver } from "./TreePlacementResolver";
import type { IEcologicalPatternProvider } from "./EcologicalPatternProvider";

interface Tree extends RenderedTree {}

export interface ITreeGenerator {
  /** Get list of enabled tree types based on visibility settings */
  getEnabledTypes(): TreeType[];

  /** Set tree type visibility */
  setTreeVisibility(visibility: Partial<TreeTypeVisibility>): void;

  /** Get current tree type visibility */
  getTreeVisibility(): TreeTypeVisibility;

  /** Create all trees for the scene */
  createTrees(dimensions: Dimensions): Tree[];
}

export function createTreeGenerator(
  placementResolver: ITreePlacementResolver,
  patternProvider: IEcologicalPatternProvider
): ITreeGenerator {
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

  // Seeded random for deterministic generation
  let seed = Date.now();

  function seededRandom(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function resetSeed(): void {
    seed = Date.now();
  }

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

  function setTreeVisibility(visibility: Partial<TreeTypeVisibility>): void {
    currentVisibility = { ...currentVisibility, ...visibility };
  }

  function getTreeVisibility(): TreeTypeVisibility {
    return { ...currentVisibility };
  }

  function createTrees(dimensions: Dimensions): Tree[] {
    const trees: Tree[] = [];
    const { width, height } = dimensions;
    const enabledTypes = getEnabledTypes();

    if (enabledTypes.length === 0) return trees;

    // Reset seeds for deterministic generation
    resetSeed();
    placementResolver.resetSeed();

    // Debug: Log which pattern is being used
    const pattern = patternProvider.getCurrentPattern();
    console.log(
      `[TreeGenerator] Creating trees with pattern: "${pattern.name}" (${pattern.id})`
    );
    console.log(`[TreeGenerator] Enabled types:`, enabledTypes);

    // Track placed trees for collision detection
    const placedTrees: PlacedTree[] = [];

    // Track which hero anchors have been used
    const usedHeroAnchors = new Set<number>();

    // Generate trees layer by layer (far to near)
    LAYER_CONFIGS.forEach((layerConfig, layerIndex) => {
      const { columns, heightPresets, widthRange } = layerConfig;
      const [minWidth, maxWidth] = widthRange;

      columns.forEach((column, i) => {
        const constants = placementResolver.getPlacementConstants();

        // Get ideal position from grid
        let idealX = placementResolver.getColumnX(column, width);
        let heightBoost = 1;

        // For mid-to-near layers (second half), check for hero anchor snapping
        if (layerIndex >= Math.floor(NUM_LAYERS / 2)) {
          const heroAnchor = placementResolver.getNearestHeroAnchor(
            idealX,
            width,
            usedHeroAnchors
          );
          if (heroAnchor !== null) {
            // Snap to hero position and mark as used
            idealX = width * heroAnchor;
            usedHeroAnchors.add(heroAnchor);
            heightBoost = constants.HERO_HEIGHT_BOOST;
          }
        }

        // Find valid position with collision avoidance
        const finalX = placementResolver.findValidPosition(
          idealX,
          layerIndex,
          placedTrees,
          width
        );

        // Skip tree if no valid position found
        if (finalX === null) return;

        // Pick tree type based on position and ecological pattern
        const normalizedX = finalX / width;
        const treeType = patternProvider.pickTypeForPosition(
          normalizedX,
          enabledTypes,
          seededRandom
        );
        const typeScale = TREE_TYPE_SCALES[treeType];

        // Calculate height with species scaling and variation
        const baseHeight = heightPresets[i] ?? heightPresets[0]!;
        const heightVariation = baseHeight * 0.05 * (seededRandom() - 0.5);
        // Apply species height scale (interpolate between min/max based on random)
        const speciesHeightScale =
          typeScale.heightMin +
          seededRandom() * (typeScale.heightMax - typeScale.heightMin);
        const finalHeight =
          height * (baseHeight + heightVariation) * heightBoost * speciesHeightScale;

        // Calculate width with species scaling
        const baseWidth = minWidth + seededRandom() * (maxWidth - minWidth);
        const speciesWidthScale =
          typeScale.widthMin +
          seededRandom() * (typeScale.widthMax - typeScale.widthMin);
        const finalWidth = height * baseWidth * speciesWidthScale;

        const treeSeed = finalX * 1000 + layerIndex;
        trees.push({
          id: `tree-${layerIndex}-${i}-${treeSeed.toFixed(0)}`,
          x: finalX,
          height: finalHeight,
          width: finalWidth,
          type: treeType,
          layer: layerIndex,
          seed: treeSeed,
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
    console.log(`[TreeGenerator] Generated ${trees.length} trees:`, typeCounts);

    // Sort by layer first (far layers draw first), then by height within layer
    return trees.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.height - b.height;
    });
  }

  return {
    getEnabledTypes,
    setTreeVisibility,
    getTreeVisibility,
    createTrees,
  };
}
