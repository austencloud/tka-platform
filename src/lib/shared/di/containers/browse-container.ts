/**
 * Browse Module ITI Container
 *
 * Provides all services for the browse feature including:
 * - Sequence loading, caching, filtering, sorting
 * - Favorites management
 * - Thumbnail rendering pipeline
 * - Navigation and event handling
 */

import { createContainer } from "iti";

// Service implementations
import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { BrowseMetadataExtractor } from "$lib/features/browse/sequences/display/services/implementations/BrowseMetadataExtractor";
import { BrowseCache } from "$lib/features/browse/sequences/display/services/implementations/BrowseCache";
import { BrowseFilter } from "$lib/features/browse/sequences/display/services/implementations/BrowseFilter";
import { BrowseSorter } from "$lib/features/browse/sequences/display/services/implementations/BrowseSorter";
import { PublicSequencesLoader } from "$lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader";
import { BrowseSectionManager } from "$lib/features/browse/sequences/display/services/implementations/BrowseSectionManager";
import { VariationGrouper } from "$lib/features/browse/sequences/display/services/implementations/VariationGrouper";
import { BrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/implementations/BrowseThumbnailProvider";
import { ThumbnailKeyDeriver } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { ThumbnailRenderQueue } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailRenderQueue";
import { ThumbnailRenderer } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer";
import { ThumbnailRenderOrchestrator } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import { ThumbnailLocalCache } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailLocalCache";
import { ThumbnailMetricsCollector } from "$lib/features/browse/sequences/display/services/implementations/ThumbnailMetricsCollector";
import { FavoritesManager } from "$lib/features/browse/shared/services/implementations/FavoritesManager";
import { FilterPersister as BrowseFilterPersister } from "$lib/shared/persistence/services/implementations/FilterPersister";
import { Navigator } from "$lib/features/browse/sequences/navigation/services/implementations/Navigator";
import { BrowseDeleter } from "$lib/features/browse/shared/services/implementations/BrowseDeleter";
import { BrowseEventHandler } from "$lib/features/browse/shared/services/implementations/BrowseEventHandler";
import { OptimizedBrowser } from "$lib/features/browse/shared/services/implementations/OptimizedBrowser";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";

// Sequence detail services
import { SequenceDetailLoader } from "$lib/features/browse/sequences/display/services/implementations/SequenceDetailLoader";
import { VideoCountManager } from "$lib/features/browse/sequences/display/services/implementations/VideoCountManager";
import { ClaudeCodeCopier } from "$lib/features/browse/sequences/display/services/implementations/ClaudeCodeCopier";

// External dependency types
import type { IWordDeriver } from "$lib/shared/foundation/services/contracts/IWordDeriver";
import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { ICloudThumbnailCache } from "$lib/features/browse/sequences/display/services/contracts/ICloudThumbnailCache";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";

/**
 * External dependencies required by the browse container.
 * These must be provided when creating the container.
 */
export interface BrowseContainerDeps {
  wordDeriver: IWordDeriver;
  deviceDetector: IDeviceDetector;
  sequenceRenderer: ISequenceRenderer;
  startPositionDeriver: IStartPositionDeriver;
  cloudThumbnailCache: ICloudThumbnailCache;
  sheetRouter: ISheetRouter | null;
  collaborativeVideoManager: ICollaborativeVideoManager;
}

/**
 * Creates the browse container with all required dependencies.
 *
 * @param deps - External dependencies from the root container
 */
export function createBrowseContainer(deps: BrowseContainerDeps) {
  // Tier 0: Services with no internal dependencies (singletons where noted)
  const tier0 = createContainer()
    .add({
      // Core calculation service
      sequenceDifficultyCalculator: () => new SequenceDifficultyCalculator(),
    })
    .add({
      // Caching and filtering (stateless, can be shared)
      browseCache: () => new BrowseCache(),
      browseFilter: () => new BrowseFilter(),
      browseSorter: () => new BrowseSorter(),
    })
    .add({
      // Variation grouping (singleton - caches variation map)
      variationGrouper: () => new VariationGrouper(),
    })
    .add({
      // Thumbnail URL handling
      browseThumbnailProvider: () => new BrowseThumbnailProvider(),
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
      browseFilterPersister: () => new BrowseFilterPersister(),
    })
    .add({
      // Navigation (named browseNavigator to avoid conflict with loop-labeler)
      browseNavigator: () => new Navigator(),
    })
    .add({
      // Deletion
      browseDeleter: () => new BrowseDeleter(),
    });

  // Tier 1: Services depending on tier 0
  const tier1 = tier0.add((ctx) => ({
    browseMetadataExtractor: () =>
      new BrowseMetadataExtractor(ctx.sequenceDifficultyCalculator),
  }));

  // Tier 2: Sequence loader (singleton - caches loaded sequences)
  // Now loads from Firestore publicSequences collection instead of static manifest
  const tier2 = tier1.add({
    browseLoader: () => new PublicSequencesLoader(),
  });

  // Tier 3: Services depending on external dependencies
  const tier3 = tier2
    .add({
      // Section manager needs external WordDeriver
      browseSectionManager: () => new BrowseSectionManager(deps.wordDeriver),
    })
    .add({
      // Optimized browser needs external DeviceDetector
      optimizedBrowser: () => new OptimizedBrowser(deps.deviceDetector),
    });

  // Tier 4: Thumbnail rendering pipeline (depends on tier 2 + external)
  const tier4 = tier3.add((ctx) => ({
    thumbnailRenderer: () =>
      new ThumbnailRenderer(
        deps.sequenceRenderer,
        deps.startPositionDeriver,
        ctx.browseLoader,
        loopDetector
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
    browseEventHandler: () =>
      new BrowseEventHandler(
        deps.sheetRouter,
        ctx.browseLoader
      ),
  }));

  // Tier 7: Sequence detail services (for SequencePanel)
  // Note: sequenceImageSharer moved to share-container for unified access
  const tier7 = tier6.add((ctx) => ({
    sequenceDetailLoader: () => new SequenceDetailLoader(ctx.browseLoader),
    videoCountManager: () =>
      new VideoCountManager(deps.collaborativeVideoManager),
  }));

  // Tier 8: Services depending on tier 7
  const container = tier7.add((ctx) => ({
    claudeCodeCopier: () => new ClaudeCodeCopier(ctx.sequenceDetailLoader),
  }));

  return container;
}

export type BrowseContainer = ReturnType<typeof createBrowseContainer>;
