import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { createHMRSafeBinder } from "../hmr/safeBind";
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
    // Use HMR-safe binder to prevent duplicate bindings during hot reload
    const bind = createHMRSafeBinder(options);

    // === EXPLORE SERVICES ===
    // Specialized explore/Explore services (use directly, no orchestration layer needed!)
    bind(TYPES.ISequenceDifficultyCalculator).to(SequenceDifficultyCalculator);
    bind(TYPES.IDiscoverMetadataExtractor).to(DiscoverMetadataExtractor);
    bind(TYPES.IDiscoverCache).to(DiscoverCache);
    bind(TYPES.IDiscoverFilter).to(DiscoverFilter);
    bind(TYPES.IDiscoverSorter).to(DiscoverSorter);
    // DiscoverLoader MUST be singleton - sequence index cache (4.7MB) needs to persist
    bind(TYPES.IDiscoverLoader).to(DiscoverLoader).inSingletonScope();

    // Other explore/Explore services
    bind(TYPES.IFavoritesManager).to(FavoritesManager);
    bind(TYPES.IFilterPersister).to(FilterPersister);

    // Note: IPersistenceService is now bound in data.module.ts to DexiePersistenceService
    bind(TYPES.ISectionManager).to(DiscoverSectionManager);
    // Singleton for variation grouping cache
    bind(TYPES.IVariationGrouper).to(VariationGrouper).inSingletonScope();
    bind(TYPES.IDiscoverThumbnailProvider).to(DiscoverThumbnailProvider);
    // Singleton for IndexedDB cache persistence (local device cache)
    bind(TYPES.IDiscoverThumbnailCache).to(DiscoverThumbnailCache).inSingletonScope();
    // Note: ICloudThumbnailCache is bound in share.module (tier 2) for cross-feature availability

    // Thumbnail rendering pipeline (new architecture)
    // Key deriver: stateless, singleton for consistency
    bind(TYPES.IThumbnailKeyDeriver).to(ThumbnailKeyDeriver).inSingletonScope();
    // Render queue: singleton to manage global concurrency (max 3)
    bind(TYPES.IThumbnailRenderQueue).to(ThumbnailRenderQueue).inSingletonScope();
    // Renderer: has constructor injection, bind directly
    bind(TYPES.IThumbnailRenderer).to(ThumbnailRenderer);
    // Orchestrator: singleton to track completion stats
    bind(TYPES.IThumbnailRenderOrchestrator).to(ThumbnailRenderOrchestrator).inSingletonScope();

    bind(TYPES.IOptimizedDiscoverer).to(OptimizedDiscoverer);
    bind(TYPES.INavigator).to(Navigator);
    bind(TYPES.IDiscoverDeleter).to(DiscoverDeleter);
    bind(TYPES.IDiscoverEventHandler).to(DiscoverEventHandler);
  }
);
