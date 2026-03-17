/**
 * Offline Module ITI Container
 *
 * Provides services for offline caching:
 * - OfflineCacheOrchestrator (coordinates proactive caching)
 * - GalleryOfflineCache is created in browse-container (shared with PublicSequencesLoader)
 */

import { createContainer } from "iti";
import { OfflineCacheOrchestrator } from "$lib/shared/offline/services/implementations/OfflineCacheOrchestrator";
import type { INetworkStatusMonitor } from "$lib/shared/sync/services/contracts/INetworkStatusMonitor";
import type { IGalleryOfflineCache } from "$lib/shared/offline/services/contracts/IGalleryOfflineCache";
import type { IThumbnailLocalCache } from "$lib/features/browse/sequences/display/services/contracts/IThumbnailLocalCache";

export interface OfflineContainerDeps {
  networkStatusMonitor: INetworkStatusMonitor;
  galleryOfflineCache: IGalleryOfflineCache;
  thumbnailLocalCache: IThumbnailLocalCache;
}

export function createOfflineContainer(deps: OfflineContainerDeps) {
  return createContainer().add({
    offlineCacheOrchestrator: () =>
      new OfflineCacheOrchestrator(
        deps.networkStatusMonitor,
        deps.galleryOfflineCache,
        deps.thumbnailLocalCache
      ),
  });
}

export type OfflineContainer = ReturnType<typeof createOfflineContainer>;
