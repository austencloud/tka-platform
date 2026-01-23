/**
 * Explore Module ITI Container
 *
 * Provides all services for the explore/browse feature including:
 * - Sequence loading, caching, filtering, sorting
 * - Favorites management
 * - Thumbnail rendering pipeline
 * - Navigation and event handling
 */

import { createContainer } from "iti";

// Service implementations
import { SequenceDifficultyCalculator } from "$lib/features/explore/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { ExploreMetadataExtractor } from "$lib/features/explore/sequences/display/services/implementations/ExploreMetadataExtractor";
import { ExploreCache } from "$lib/features/explore/sequences/display/services/implementations/ExploreCache";
import { ExploreFilter } from "$lib/features/explore/sequences/display/services/implementations/ExploreFilter";
import { ExploreSorter } from "$lib/features/explore/sequences/display/services/implementations/ExploreSorter";
import { PublicSequencesLoader } from "$lib/features/explore/sequences/display/services/implementations/PublicSequencesLoader";
import { ExploreSectionManager } from "$lib/features/explore/sequences/display/services/implementations/ExploreSectionManager";
import { VariationGrouper } from "$lib/features/explore/sequences/display/services/implementations/VariationGrouper";
import { ExploreThumbnailProvider } from "$lib/features/explore/sequences/display/services/implementations/ExploreThumbnailProvider";
import { ThumbnailKeyDeriver } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { ThumbnailRenderQueue } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailRenderQueue";
import { ThumbnailRenderer } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailRenderer";
import { ThumbnailRenderOrchestrator } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import { ThumbnailLocalCache } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailLocalCache";
import { ThumbnailMetricsCollector } from "$lib/features/explore/sequences/display/services/implementations/ThumbnailMetricsCollector";
import { FavoritesManager } from "$lib/features/explore/shared/services/implementations/FavoritesManager";
import { FilterPersister as ExploreFilterPersister } from "$lib/shared/persistence/services/implementations/FilterPersister";
import { Navigator } from "$lib/features/explore/sequences/navigation/services/implementations/Navigator";
import { ExploreDeleter } from "$lib/features/explore/shared/services/implementations/ExploreDeleter";
import { ExploreEventHandler } from "$lib/features/explore/shared/services/implementations/ExploreEventHandler";
import { OptimizedExploreer } from "$lib/features/explore/shared/services/implementations/OptimizedExploreer";

// Sequence detail services
import { SequenceDetailLoader } from "$lib/features/explore/sequences/display/services/implementations/SequenceDetailLoader";
import { VideoCountManager } from "$lib/features/explore/sequences/display/services/implementations/VideoCountManager";
import { ClaudeCodeCopier } from "$lib/features/explore/sequences/display/services/implementations/ClaudeCodeCopier";

// External dependency types
import type { IWordDeriver } from "$lib/shared/foundation/services/contracts/IWordDeriver";
import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { ICloudThumbnailCache } from "$lib/features/explore/sequences/display/services/contracts/ICloudThumbnailCache";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";

/**
 * External dependencies required by the explore container.
 * These must be provided when creating the container.
 */
export interface ExploreContainerDeps {
  wordDeriver: IWordDeriver;
  deviceDetector: IDeviceDetector;
  sequenceRenderer: ISequenceRenderer;
  startPositionDeriver: IStartPositionDeriver;
  cloudThumbnailCache: ICloudThumbnailCache;
  sheetRouter: ISheetRouter | null;
  collaborativeVideoManager: ICollaborativeVideoManager;
}

/**
 * Creates the explore container with all required dependencies.
 *
 * @param deps - External dependencies from the root container
 */
export function createExploreContainer(deps: ExploreContainerDeps) {
  // Tier 0: Services with no internal dependencies (singletons where noted)
  const tier0 = createContainer()
    .add({
      // Core calculation service
      sequenceDifficultyCalculator: () => new SequenceDifficultyCalculator(),
    })
    .add({
      // Caching and filtering (stateless, can be shared)
      exploreCache: () => new ExploreCache(),
      exploreFilter: () => new ExploreFilter(),
      exploreSorter: () => new ExploreSorter(),
    })
    .add({
      // Variation grouping (singleton - caches variation map)
      variationGrouper: () => new VariationGrouper(),
    })
    .add({
      // Thumbnail URL handling
      exploreThumbnailProvider: () => new ExploreThumbnailProvider(),
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
      exploreFilterPersister: () => new ExploreFilterPersister(),
    })
    .add({
      // Navigation (named exploreNavigator to avoid conflict with loop-labeler)
      exploreNavigator: () => new Navigator(),
    })
    .add({
      // Deletion
      exploreDeleter: () => new ExploreDeleter(),
    })
;

  // Tier 1: Services depending on tier 0
  const tier1 = tier0.add((ctx) => ({
    exploreMetadataExtractor: () =>
      new ExploreMetadataExtractor(ctx.sequenceDifficultyCalculator),
  }));

  // Tier 2: Sequence loader (singleton - caches loaded sequences)
  // Now loads from Firestore publicSequences collection instead of static manifest
  const tier2 = tier1.add({
    exploreLoader: () => new PublicSequencesLoader(),
  });

  // Tier 3: Services depending on external dependencies
  const tier3 = tier2
    .add({
      // Section manager needs external WordDeriver
      exploreSectionManager: () =>
        new ExploreSectionManager(deps.wordDeriver),
    })
    .add({
      // Optimized exploreer needs external DeviceDetector
      optimizedExploreer: () =>
        new OptimizedExploreer(deps.deviceDetector),
    });

  // Tier 4: Thumbnail rendering pipeline (depends on tier 2 + external)
  const tier4 = tier3.add((ctx) => ({
    thumbnailRenderer: () =>
      new ThumbnailRenderer(
        deps.sequenceRenderer,
        deps.startPositionDeriver,
        ctx.exploreLoader
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
    exploreEventHandler: () =>
      new ExploreEventHandler(
        ctx.exploreThumbnailProvider,
        deps.sheetRouter,
        ctx.exploreLoader
      ),
  }));

  // Tier 7: Sequence detail services (for SequencePanel)
  // Note: sequenceImageSharer moved to share-container for unified access
  const tier7 = tier6.add((ctx) => ({
    sequenceDetailLoader: () => new SequenceDetailLoader(ctx.exploreLoader),
    videoCountManager: () => new VideoCountManager(deps.collaborativeVideoManager),
  }));

  // Tier 8: Services depending on tier 7
  const container = tier7.add((ctx) => ({
    claudeCodeCopier: () => new ClaudeCodeCopier(ctx.sequenceDetailLoader),
  }));

  return container;
}

export type ExploreContainer = ReturnType<typeof createExploreContainer>;
