/**
 * Discover Module ITI Container
 *
 * Provides all services for the discover/browse feature including:
 * - Sequence loading, caching, filtering, sorting
 * - Favorites management
 * - Thumbnail rendering pipeline
 * - Navigation and event handling
 */

import { createContainer } from "iti";

// Service implementations
import { SequenceDifficultyCalculator } from "$lib/features/discover/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { DiscoverMetadataExtractor } from "$lib/features/discover/sequences/display/services/implementations/DiscoverMetadataExtractor";
import { DiscoverCache } from "$lib/features/discover/sequences/display/services/implementations/DiscoverCache";
import { DiscoverFilter } from "$lib/features/discover/sequences/display/services/implementations/DiscoverFilter";
import { DiscoverSorter } from "$lib/features/discover/sequences/display/services/implementations/DiscoverSorter";
import { DiscoverLoader } from "$lib/features/discover/sequences/display/services/implementations/DiscoverLoader";
import { DiscoverSectionManager } from "$lib/features/discover/sequences/display/services/implementations/DiscoverSectionManager";
import { VariationGrouper } from "$lib/features/discover/sequences/display/services/implementations/VariationGrouper";
import { DiscoverThumbnailProvider } from "$lib/features/discover/sequences/display/services/implementations/DiscoverThumbnailProvider";
import { DiscoverThumbnailCache } from "$lib/features/discover/sequences/display/services/implementations/DiscoverThumbnailCache";
import { ThumbnailKeyDeriver } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { ThumbnailRenderQueue } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderQueue";
import { ThumbnailRenderer } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderer";
import { ThumbnailRenderOrchestrator } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import { FavoritesManager } from "$lib/features/discover/shared/services/implementations/FavoritesManager";
import { FilterPersister } from "$lib/shared/persistence/services/implementations/FilterPersister";
import { Navigator } from "$lib/features/discover/sequences/navigation/services/implementations/Navigator";
import { DiscoverDeleter } from "$lib/features/discover/shared/services/implementations/DiscoverDeleter";
import { DiscoverEventHandler } from "$lib/features/discover/shared/services/implementations/DiscoverEventHandler";
import { OptimizedDiscoverer } from "$lib/features/discover/shared/services/implementations/OptimizedDiscoverer";

// External dependency types
import type { IWordDeriver } from "$lib/shared/foundation/services/contracts/IWordDeriver";
import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { ICloudThumbnailCache } from "$lib/features/discover/sequences/display/services/contracts/ICloudThumbnailCache";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";

/**
 * External dependencies required by the discover container.
 * These must be provided when creating the container.
 */
export interface DiscoverContainerDeps {
  wordDeriver: IWordDeriver;
  deviceDetector: IDeviceDetector;
  sequenceRenderer: ISequenceRenderer;
  startPositionDeriver: IStartPositionDeriver;
  cloudThumbnailCache: ICloudThumbnailCache;
  sheetRouter: ISheetRouter | null;
}

/**
 * Creates the discover container with all required dependencies.
 *
 * @param deps - External dependencies from the root container
 */
export function createDiscoverContainer(deps: DiscoverContainerDeps) {
  // Tier 0: Services with no internal dependencies (singletons where noted)
  const tier0 = createContainer()
    .add({
      // Core calculation service
      sequenceDifficultyCalculator: () => new SequenceDifficultyCalculator(),
    })
    .add({
      // Caching and filtering (stateless, can be shared)
      discoverCache: () => new DiscoverCache(),
      discoverFilter: () => new DiscoverFilter(),
      discoverSorter: () => new DiscoverSorter(),
    })
    .add({
      // Variation grouping (singleton - caches variation map)
      variationGrouper: () => new VariationGrouper(),
    })
    .add({
      // Thumbnail URL handling
      discoverThumbnailProvider: () => new DiscoverThumbnailProvider(),
    })
    .add({
      // IndexedDB cache for rendered thumbnails (singleton - maintains DB connection)
      discoverThumbnailCache: () => new DiscoverThumbnailCache(),
    })
    .add({
      // Thumbnail key derivation (singleton - stateless but for consistency)
      thumbnailKeyDeriver: () => new ThumbnailKeyDeriver(),
    })
    .add({
      // Render queue (singleton - manages global concurrency)
      thumbnailRenderQueue: () => new ThumbnailRenderQueue(),
    })
    .add({
      // User preferences
      favoritesManager: () => new FavoritesManager(),
      filterPersister: () => new FilterPersister(),
    })
    .add({
      // Navigation (named discoverNavigator to avoid conflict with loop-labeler)
      discoverNavigator: () => new Navigator(),
    })
    .add({
      // Deletion
      discoverDeleter: () => new DiscoverDeleter(),
    });

  // Tier 1: Services depending on tier 0
  const tier1 = tier0.add((ctx) => ({
    discoverMetadataExtractor: () =>
      new DiscoverMetadataExtractor(ctx.sequenceDifficultyCalculator),
  }));

  // Tier 2: Services depending on tier 0 and 1 (singleton - caches sequence index)
  const tier2 = tier1.add((ctx) => ({
    discoverLoader: () =>
      new DiscoverLoader(
        ctx.discoverMetadataExtractor,
        ctx.sequenceDifficultyCalculator
      ),
  }));

  // Tier 3: Services depending on external dependencies
  const tier3 = tier2
    .add({
      // Section manager needs external WordDeriver
      discoverSectionManager: () =>
        new DiscoverSectionManager(deps.wordDeriver),
    })
    .add({
      // Optimized discoverer needs external DeviceDetector
      optimizedDiscoverer: () =>
        new OptimizedDiscoverer(deps.deviceDetector),
    });

  // Tier 4: Thumbnail rendering pipeline (depends on tier 2 + external)
  const tier4 = tier3.add((ctx) => ({
    thumbnailRenderer: () =>
      new ThumbnailRenderer(
        deps.sequenceRenderer,
        deps.startPositionDeriver,
        ctx.discoverLoader
      ),
  }));

  // Tier 5: Orchestrator (singleton - tracks completion stats)
  const tier5 = tier4.add((ctx) => ({
    thumbnailRenderOrchestrator: () =>
      new ThumbnailRenderOrchestrator(
        ctx.thumbnailKeyDeriver,
        ctx.thumbnailRenderQueue,
        ctx.thumbnailRenderer,
        deps.cloudThumbnailCache
      ),
  }));

  // Tier 6: Event handler (depends on multiple services)
  const container = tier5.add((ctx) => ({
    discoverEventHandler: () =>
      new DiscoverEventHandler(
        ctx.discoverThumbnailProvider,
        deps.sheetRouter,
        ctx.discoverLoader
      ),
  }));

  return container;
}

export type DiscoverContainer = ReturnType<typeof createDiscoverContainer>;
