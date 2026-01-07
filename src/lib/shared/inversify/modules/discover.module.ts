import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { DiscoverCache } from "../../../features/discover/gallery/display/services/implementations/DiscoverCache";
import { DiscoverFilter } from "../../../features/discover/gallery/display/services/implementations/DiscoverFilter";
import { DiscoverLoader } from "../../../features/discover/gallery/display/services/implementations/DiscoverLoader";
import { DiscoverMetadataExtractor } from "../../../features/discover/gallery/display/services/implementations/DiscoverMetadataExtractor";
import { DiscoverSectionManager } from "../../../features/discover/gallery/display/services/implementations/DiscoverSectionManager";
import { DiscoverSorter } from "../../../features/discover/gallery/display/services/implementations/DiscoverSorter";
import { DiscoverThumbnailProvider } from "../../../features/discover/gallery/display/services/implementations/DiscoverThumbnailProvider";
import { DiscoverThumbnailCache } from "../../../features/discover/gallery/display/services/implementations/DiscoverThumbnailCache";
import { FavoritesManager } from "../../../features/discover/shared/services/implementations/FavoritesManager";
import { Navigator } from "../../../features/discover/gallery/navigation/services/implementations/Navigator";
import { DiscoverDeleter } from "../../../features/discover/shared/services/implementations/DiscoverDeleter";
import { DiscoverEventHandler } from "../../../features/discover/shared/services/implementations/DiscoverEventHandler";
import { SequenceDifficultyCalculator } from "../../../features/discover/gallery/display/services/implementations/SequenceDifficultyCalculator";
import { OptimizedDiscoverer } from "../../../features/discover/shared/services/implementations/OptimizedDiscoverer";
import { FilterPersister } from "../../persistence/services/implementations/FilterPersister";
import { TYPES } from "../types";

export const exploreModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === EXPLORE SERVICES ===
    // Guard against duplicate binding (module may be loaded multiple times via HMR or race conditions)
    const bindIfNeeded = <T>(
      type: symbol,
      impl: new (...args: unknown[]) => T
    ) => {
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
    bindIfNeeded(TYPES.ISectionManager, DiscoverSectionManager);
    bindIfNeeded(TYPES.IDiscoverThumbnailProvider, DiscoverThumbnailProvider);
    // Singleton for IndexedDB cache persistence (local device cache)
    if (!options.isBound(TYPES.IDiscoverThumbnailCache)) {
      options
        .bind(TYPES.IDiscoverThumbnailCache)
        .to(DiscoverThumbnailCache)
        .inSingletonScope();
    }
    // Note: ICloudThumbnailCache is bound in share.module (tier 2) for cross-feature availability
    bindIfNeeded(TYPES.IOptimizedDiscoverer, OptimizedDiscoverer);
    bindIfNeeded(TYPES.INavigator, Navigator);
    bindIfNeeded(TYPES.IDiscoverDeleter, DiscoverDeleter);
    bindIfNeeded(TYPES.IDiscoverEventHandler, DiscoverEventHandler);
  }
);
