/**
 * Tree Silhouette System
 *
 * Orchestrates tree silhouette rendering by composing specialized services:
 * - TreePlacementResolver: Grid-based placement with collision detection
 * - EcologicalPatternProvider: Zone-based tree type distribution
 * - TreeSilhouetteRenderer: Image-based rendering with depth tinting
 * - TreeGenerator: Creates tree instances with proper positioning
 *
 * This system manages layer-based canvas caching and coordinates the render pipeline.
 */

import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  TreeType,
  TreeTypeVisibility,
  RenderedTree,
  PlacementConfig,
  EcologicalPattern,
} from "../domain/models/tree-silhouette-models";
import { NUM_LAYERS, ECOLOGICAL_PATTERNS } from "../domain/constants/tree-silhouette-constants";
import {
  createTreeSilhouetteImageLoader,
  type TreeSilhouetteImageLoader,
} from "./TreeSilhouetteImageLoader";
import {
  createTreePlacementResolver,
  type ITreePlacementResolver,
} from "./trees/TreePlacementResolver";
import {
  createEcologicalPatternProvider,
  type IEcologicalPatternProvider,
} from "./trees/EcologicalPatternProvider";
import {
  createTreeSilhouetteRenderer,
  type ITreeSilhouetteRenderer,
} from "./trees/TreeSilhouetteRenderer";
import {
  createTreeGenerator,
  type ITreeGenerator,
} from "./trees/TreeGenerator";

// Re-export types for external consumers
export type {
  TreeType,
  TreeTypeVisibility,
  RenderedTree,
  PlacementConfig,
  EcologicalPattern,
};
export { NUM_LAYERS, ECOLOGICAL_PATTERNS };

interface Tree extends RenderedTree {}

/**
 * Creates forest silhouettes rising from the bottom of the screen.
 * Trees are dark shapes against the sky - no ground layers needed.
 */
export function createTreeSilhouetteSystem() {
  // ===================
  // COMPOSED SERVICES
  // ===================

  const imageLoader: TreeSilhouetteImageLoader = createTreeSilhouetteImageLoader();
  const placementResolver: ITreePlacementResolver = createTreePlacementResolver();
  const patternProvider: IEcologicalPatternProvider = createEcologicalPatternProvider();
  const renderer: ITreeSilhouetteRenderer = createTreeSilhouetteRenderer(imageLoader);
  const generator: ITreeGenerator = createTreeGenerator(placementResolver, patternProvider);

  // ===================
  // CACHE STATE
  // ===================

  // One cached canvas per layer for interleaved rendering with grass
  let layerCanvases: (OffscreenCanvas | null)[] = Array(NUM_LAYERS).fill(null);
  let cachedDimensions: Dimensions | null = null;

  // Store current trees for inspection and deletion
  let currentTrees: Tree[] = [];

  // ===================
  // INITIALIZATION
  // ===================

  function initialize(dimensions: Dimensions): void {
    // Start image preloading in the background
    if (!renderer.areImagesLoaded()) {
      renderer.preloadImages().then(() => {
        // Re-render with images now that they're loaded
        if (cachedDimensions) {
          renderToCache(cachedDimensions);
        }
      });
    }
    renderToCache(dimensions);
  }

  async function preloadImages(): Promise<void> {
    await renderer.preloadImages();
  }

  // ===================
  // CACHE RENDERING
  // ===================

  function renderToCache(dimensions: Dimensions): void {
    cachedDimensions = dimensions;

    // Clear used images tracker for fresh scene
    renderer.clearUsedImages();

    const trees = generator.createTrees(dimensions);

    // Store trees for external access
    currentTrees = trees;

    // Create separate canvas for each layer
    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Get the ground line for this layer (far = higher up, near = below viewport)
      const layerBaseY = renderer.getLayerBaseY(layer, dimensions.height);

      // Draw only trees in this layer
      const layerTrees = trees.filter((t) => t.layer === layer);
      for (const tree of layerTrees) {
        // Draw tree using pre-loaded silhouette image
        const imageFilename = renderer.drawTreeImage(
          ctx,
          tree.x,
          layerBaseY,
          tree.width,
          tree.height,
          tree.type,
          tree.layer,
          tree.seed
        );
        // Track which image was used for this tree
        if (imageFilename) {
          tree.imageFilename = imageFilename;
        }
      }

      layerCanvases[layer] = canvas;
    }
  }

  /**
   * Re-render the cache using the current trees (without regenerating).
   * Used after removing trees to update the display.
   */
  function rerenderCurrentTrees(dimensions: Dimensions): void {
    cachedDimensions = dimensions;

    // Clear used images tracker
    renderer.clearUsedImages();

    // Create separate canvas for each layer
    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Get the ground line for this layer
      const layerBaseY = renderer.getLayerBaseY(layer, dimensions.height);

      // Draw only trees in this layer that still exist
      const layerTrees = currentTrees.filter((t) => t.layer === layer);
      for (const tree of layerTrees) {
        const imageFilename = renderer.drawTreeImage(
          ctx,
          tree.x,
          layerBaseY,
          tree.width,
          tree.height,
          tree.type,
          tree.layer,
          tree.seed
        );
        if (imageFilename) {
          tree.imageFilename = imageFilename;
        }
      }

      layerCanvases[layer] = canvas;
    }
  }

  // ===================
  // DRAWING
  // ===================

  /**
   * Check if dimensions have changed (prevents unnecessary regeneration).
   */
  function dimensionsChanged(dimensions: Dimensions): boolean {
    if (!cachedDimensions) return true;
    return (
      cachedDimensions.width !== dimensions.width ||
      cachedDimensions.height !== dimensions.height
    );
  }

  /**
   * Draw all tree layers at once (backwards compatibility).
   */
  function draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Only initialize if cache doesn't exist OR dimensions changed
    if (!layerCanvases[0] || dimensionsChanged(dimensions)) {
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
   * Draw a specific tree layer (for interleaving with grass).
   * @param layer 0 = far, 6 = near
   */
  function drawLayer(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    layer: number
  ): void {
    // Only initialize if cache doesn't exist OR dimensions changed
    if (!layerCanvases[0] || dimensionsChanged(dimensions)) {
      initialize(dimensions);
    }

    const canvas = layerCanvases[layer];
    if (canvas) {
      ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
    }
  }

  // ===================
  // EVENT HANDLERS
  // ===================

  function handleResize(
    _oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    // Skip if dimensions haven't actually changed
    if (!dimensionsChanged(newDimensions)) {
      return;
    }
    initialize(newDimensions);
  }

  function regenerate(dimensions: Dimensions): void {
    renderToCache(dimensions);
  }

  function cleanup(): void {
    layerCanvases = Array(NUM_LAYERS).fill(null);
    cachedDimensions = null;
  }

  // ===================
  // TREE MANAGEMENT API
  // ===================

  function getRenderedTrees(): RenderedTree[] {
    return currentTrees.map((t) => ({ ...t }));
  }

  function removeTree(treeId: string): boolean {
    const index = currentTrees.findIndex((t) => t.id === treeId);
    if (index === -1) return false;

    currentTrees.splice(index, 1);

    // Re-render with remaining trees
    if (cachedDimensions) {
      rerenderCurrentTrees(cachedDimensions);
    }

    return true;
  }

  function removeTreesByImage(imageFilename: string): number {
    const initialCount = currentTrees.length;
    currentTrees = currentTrees.filter((t) => t.imageFilename !== imageFilename);
    const removedCount = initialCount - currentTrees.length;

    if (removedCount > 0 && cachedDimensions) {
      rerenderCurrentTrees(cachedDimensions);
    }

    return removedCount;
  }

  function getTreeCounts(): { total: number; byLayer: number[] } {
    const byLayer = Array(NUM_LAYERS).fill(0);
    for (const tree of currentTrees) {
      byLayer[tree.layer]++;
    }
    return { total: currentTrees.length, byLayer };
  }

  // ===================
  // DELEGATED APIs
  // ===================

  return {
    // Lifecycle
    initialize,
    preloadImages,
    draw,
    drawLayer,
    handleResize,
    regenerate,
    cleanup,

    // Visibility (delegated to generator)
    setTreeVisibility: (visibility: Partial<TreeTypeVisibility>) =>
      generator.setTreeVisibility(visibility),
    getTreeVisibility: () => generator.getTreeVisibility(),

    // Placement config (delegated to placement resolver)
    setPlacementConfig: (config: Partial<PlacementConfig>) =>
      placementResolver.setPlacementConfig(config),
    getPlacementConfig: () => placementResolver.getPlacementConfig(),
    resetPlacementConfig: () => placementResolver.resetPlacementConfig(),

    // Ecological pattern API (delegated to pattern provider)
    setEcologicalPattern: (patternId: string) =>
      patternProvider.setEcologicalPattern(patternId),
    getEcologicalPatternId: () => patternProvider.getEcologicalPatternId(),
    getEcologicalPattern: () => patternProvider.getEcologicalPattern(),
    getAvailablePatterns: () => patternProvider.getAvailablePatterns(),
    setRandomEcologicalPattern: () => patternProvider.setRandomEcologicalPattern(),

    // Tree management API
    getRenderedTrees,
    removeTree,
    removeTreesByImage,
    getTreeCounts,
  };
}
