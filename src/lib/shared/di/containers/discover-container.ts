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
import { PublicSequencesLoader } from "$lib/features/discover/sequences/display/services/implementations/PublicSequencesLoader";
import { DiscoverSectionManager } from "$lib/features/discover/sequences/display/services/implementations/DiscoverSectionManager";
import { VariationGrouper } from "$lib/features/discover/sequences/display/services/implementations/VariationGrouper";
import { DiscoverThumbnailProvider } from "$lib/features/discover/sequences/display/services/implementations/DiscoverThumbnailProvider";
import { ThumbnailKeyDeriver } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { ThumbnailRenderQueue } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderQueue";
import { ThumbnailRenderer } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderer";
import { ThumbnailRenderOrchestrator } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import { ThumbnailLocalCache } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailLocalCache";
import { ThumbnailMetricsCollector } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailMetricsCollector";
import { FavoritesManager } from "$lib/features/discover/shared/services/implementations/FavoritesManager";
import { FilterPersister as DiscoverFilterPersister } from "$lib/shared/persistence/services/implementations/FilterPersister";
import { Navigator } from "$lib/features/discover/sequences/navigation/services/implementations/Navigator";
import { DiscoverDeleter } from "$lib/features/discover/shared/services/implementations/DiscoverDeleter";
import { DiscoverEventHandler } from "$lib/features/discover/shared/services/implementations/DiscoverEventHandler";
import { OptimizedDiscoverer } from "$lib/features/discover/shared/services/implementations/OptimizedDiscoverer";

// Sequence detail services
import { SequenceDetailLoader } from "$lib/features/discover/sequences/display/services/implementations/SequenceDetailLoader";
import { VideoCountManager } from "$lib/features/discover/sequences/display/services/implementations/VideoCountManager";
import { ClaudeCodeCopier } from "$lib/features/discover/sequences/display/services/implementations/ClaudeCodeCopier";

// Grid interaction services
import { PinchZoomGridController } from "$lib/features/discover/sequences/display/services/implementations/PinchZoomGridController";

// External dependency types
import type { IWordDeriver } from "$lib/shared/foundation/services/contracts/IWordDeriver";
import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { ICloudThumbnailCache } from "$lib/features/discover/sequences/display/services/contracts/ICloudThumbnailCache";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";

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
  collaborativeVideoManager: ICollaborativeVideoManager;
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
      // IndexedDB cache for ALL thumbnails (unified local cache, singleton)
      thumbnailLocalCache: () => new ThumbnailLocalCache(),
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
      // Metrics collector (singleton - tracks performance data)
      thumbnailMetricsCollector: () => {
        const collector = new ThumbnailMetricsCollector();
        // Auto-start logging in dev mode
        if (import.meta.env.DEV) {
          collector.startLogging(30000); // Log every 30s
        }
        return collector;
      },
    })
    .add({
      // User preferences
      favoritesManager: () => new FavoritesManager(),
      discoverFilterPersister: () => new DiscoverFilterPersister(),
    })
    .add({
      // Navigation (named discoverNavigator to avoid conflict with loop-labeler)
      discoverNavigator: () => new Navigator(),
    })
    .add({
      // Deletion
      discoverDeleter: () => new DiscoverDeleter(),
    })
    .add({
      // Pinch-to-zoom for grid (factory - creates new instance per grid)
      pinchZoomGridControllerFactory: () => () => new PinchZoomGridController(),
    });

  // Tier 1: Services depending on tier 0
  const tier1 = tier0.add((ctx) => ({
    discoverMetadataExtractor: () =>
      new DiscoverMetadataExtractor(ctx.sequenceDifficultyCalculator),
  }));

  // Tier 2: Sequence loader (singleton - caches loaded sequences)
  // Now loads from Firestore publicSequences collection instead of static manifest
  const tier2 = tier1.add({
    discoverLoader: () => new PublicSequencesLoader(),
  });

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
        deps.cloudThumbnailCache,
        ctx.thumbnailLocalCache,
        ctx.thumbnailMetricsCollector
      ),
  }));

  // Tier 6: Event handler (depends on multiple services)
  const tier6 = tier5.add((ctx) => ({
    discoverEventHandler: () =>
      new DiscoverEventHandler(
        ctx.discoverThumbnailProvider,
        deps.sheetRouter,
        ctx.discoverLoader
      ),
  }));

  // Tier 7: Sequence detail services (for SequencePanel)
  // Note: sequenceImageSharer moved to share-container for unified access
  const tier7 = tier6.add((ctx) => ({
    sequenceDetailLoader: () => new SequenceDetailLoader(ctx.discoverLoader),
    videoCountManager: () => new VideoCountManager(deps.collaborativeVideoManager),
  }));

  // Tier 8: Services depending on tier 7
  const container = tier7.add((ctx) => ({
    claudeCodeCopier: () => new ClaudeCodeCopier(ctx.sequenceDetailLoader),
  }));

  return container;
}

export type DiscoverContainer = ReturnType<typeof createDiscoverContainer>;
