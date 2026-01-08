/**
 * Discover/Browse Service Type Identifiers
 *
 * Services for browsing, filtering, and displaying sequences.
 */

export const DiscoverTypes = {
  // Discover Services
  IDiscoverThumbnailProvider: Symbol.for("IDiscoverThumbnailProvider"),
  IDiscoverThumbnailCache: Symbol.for("IDiscoverThumbnailCache"),
  ICloudThumbnailCache: Symbol.for("ICloudThumbnailCache"),
  IThumbnailKeyDeriver: Symbol.for("IThumbnailKeyDeriver"),
  IThumbnailRenderQueue: Symbol.for("IThumbnailRenderQueue"),
  IThumbnailRenderer: Symbol.for("IThumbnailRenderer"),
  IThumbnailRenderOrchestrator: Symbol.for("IThumbnailRenderOrchestrator"),
  IDiscoverCache: Symbol.for("IDiscoverCache"),
  IDiscoverFilter: Symbol.for("IDiscoverFilter"),
  IDiscoverLoader: Symbol.for("IDiscoverLoader"),
  IDiscoverMetadataExtractor: Symbol.for("IDiscoverMetadataExtractor"),
  IDiscoverSorter: Symbol.for("IDiscoverSorter"),
  IOptimizedDiscoverer: Symbol.for("IOptimizedDiscoverer"),
  IDiscoverEventHandler: Symbol.for("IDiscoverEventHandler"),
  IDiscoverPanelManager: Symbol.for("IDiscoverPanelManager"),

  // Browse State
  IBrowseStatePersister: Symbol.for("IBrowseStatePersister"),
  IFilterPersister: Symbol.for("IFilterPersister"),

  // Section & Index
  ISectionManager: Symbol.for("ISectionManager"),
  ISequenceIndexer: Symbol.for("ISequenceIndexer"),
  ISequenceDifficultyCalculator: Symbol.for("ISequenceDifficultyCalculator"),
  IVariationGrouper: Symbol.for("IVariationGrouper"),

  // Favorites & Delete
  IFavoritesManager: Symbol.for("IFavoritesManager"),
  IDiscoverDeleter: Symbol.for("IDiscoverDeleter"),

  // Community
  ILeaderboardManager: Symbol.for("ILeaderboardManager"),
  ICommunityStatsService: Symbol.for("ICommunityStatsService"),
} as const;
