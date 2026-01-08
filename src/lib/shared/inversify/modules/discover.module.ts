import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { DiscoverCache } from "../../../features/discover/sequences/display/services/implementations/DiscoverCache";
import { DiscoverFilter } from "../../../features/discover/sequences/display/services/implementations/DiscoverFilter";
import { DiscoverLoader } from "../../../features/discover/sequences/display/services/implementations/DiscoverLoader";
import { DiscoverMetadataExtractor } from "../../../features/discover/sequences/display/services/implementations/DiscoverMetadataExtractor";
import { DiscoverSectionManager } from "../../../features/discover/sequences/display/services/implementations/DiscoverSectionManager";
import { DiscoverSorter } from "../../../features/discover/sequences/display/services/implementations/DiscoverSorter";
import { DiscoverThumbnailProvider } from "../../../features/discover/sequences/display/services/implementations/DiscoverThumbnailProvider";
import { DiscoverThumbnailCache } from "../../../features/discover/sequences/display/services/implementations/DiscoverThumbnailCache";
import { VariationGrouper } from "../../../features/discover/sequences/display/services/implementations/VariationGrouper";
import { ThumbnailKeyDeriver } from "../../../features/discover/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { ThumbnailRenderQueue } from "../../../features/discover/sequences/display/services/implementations/ThumbnailRenderQueue";
import { ThumbnailRenderer } from "../../../features/discover/sequences/display/services/implementations/ThumbnailRenderer";
import { ThumbnailRenderOrchestrator } from "../../../features/discover/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import { FavoritesManager } from "../../../features/discover/shared/services/implementations/FavoritesManager";
import { Navigator } from "../../../features/discover/sequences/navigation/services/implementations/Navigator";
import { DiscoverDeleter } from "../../../features/discover/shared/services/implementations/DiscoverDeleter";
import { DiscoverEventHandler } from "../../../features/discover/shared/services/implementations/DiscoverEventHandler";
import { SequenceDifficultyCalculator } from "../../../features/discover/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { OptimizedDiscoverer } from "../../../features/discover/shared/services/implementations/OptimizedDiscoverer";
import { FilterPersister } from "../../persistence/services/implementations/FilterPersister";
import { TYPES } from "../types";

export const exploreModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === EXPLORE SERVICES ===
    // Guard against duplicate binding (module may be loaded multiple times via HMR or race conditions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bindIfNeeded = <T>(type: symbol, impl: new (...args: any[]) => T) => {
      if (!options.isBound(type)) {
        return options.bind(type).to(impl);
      }
      return null;
    };

    // Specialized explore/Explore services (use directly, no orchestration layer needed!)
    bindIfNeeded(TYPES.ISequenceDifficultyCalculator, SequenceDifficultyCalculator);
    bindIfNeeded(TYPES.IDiscoverMetadataExtractor, DiscoverMetadataExtractor);
    bindIfNeeded(TYPES.IDiscoverCache, DiscoverCache);
    bindIfNeeded(TYPES.IDiscoverFilter, DiscoverFilter);
    bindIfNeeded(TYPES.IDiscoverSorter, DiscoverSorter);
    // DiscoverLoader MUST be singleton - sequence index cache (4.7MB) needs to persist
    if (!options.isBound(TYPES.IDiscoverLoader)) {
      options.bind(TYPES.IDiscoverLoader).to(DiscoverLoader).inSingletonScope();
    }

    // Other explore/Explore services
    bindIfNeeded(TYPES.IFavoritesManager, FavoritesManager);
    bindIfNeeded(TYPES.IFilterPersister, FilterPersister);

    // Note: IPersistenceService is now bound in data.module.ts to DexiePersistenceService
    // DiscoverSectionManager has constructor injection, can't use bindIfNeeded helper
    if (!options.isBound(TYPES.ISectionManager)) {
      options.bind(TYPES.ISectionManager).to(DiscoverSectionManager);
    }
    // Singleton for variation grouping cache
    if (!options.isBound(TYPES.IVariationGrouper)) {
      options.bind(TYPES.IVariationGrouper).to(VariationGrouper).inSingletonScope();
    }
    bindIfNeeded(TYPES.IDiscoverThumbnailProvider, DiscoverThumbnailProvider);
    // Singleton for IndexedDB cache persistence (local device cache)
    if (!options.isBound(TYPES.IDiscoverThumbnailCache)) {
      options
        .bind(TYPES.IDiscoverThumbnailCache)
        .to(DiscoverThumbnailCache)
        .inSingletonScope();
    }
    // Note: ICloudThumbnailCache is bound in share.module (tier 2) for cross-feature availability

    // Thumbnail rendering pipeline (new architecture)
    // Key deriver: stateless, singleton for consistency
    if (!options.isBound(TYPES.IThumbnailKeyDeriver)) {
      options.bind(TYPES.IThumbnailKeyDeriver).to(ThumbnailKeyDeriver).inSingletonScope();
    }
    // Render queue: singleton to manage global concurrency (max 3)
    if (!options.isBound(TYPES.IThumbnailRenderQueue)) {
      options.bind(TYPES.IThumbnailRenderQueue).to(ThumbnailRenderQueue).inSingletonScope();
    }
    // Renderer: has constructor injection, bind directly
    if (!options.isBound(TYPES.IThumbnailRenderer)) {
      options.bind(TYPES.IThumbnailRenderer).to(ThumbnailRenderer);
    }
    // Orchestrator: singleton to track completion stats
    if (!options.isBound(TYPES.IThumbnailRenderOrchestrator)) {
      options.bind(TYPES.IThumbnailRenderOrchestrator).to(ThumbnailRenderOrchestrator).inSingletonScope();
    }

    bindIfNeeded(TYPES.IOptimizedDiscoverer, OptimizedDiscoverer);
    bindIfNeeded(TYPES.INavigator, Navigator);
    bindIfNeeded(TYPES.IDiscoverDeleter, DiscoverDeleter);
    bindIfNeeded(TYPES.IDiscoverEventHandler, DiscoverEventHandler);
  }
);
