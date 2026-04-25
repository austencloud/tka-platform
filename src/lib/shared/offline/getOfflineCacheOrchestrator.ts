import type { IOfflineCacheOrchestrator } from './services/contracts/IOfflineCacheOrchestrator';
import { OfflineCacheOrchestrator } from './services/implementations/OfflineCacheOrchestrator';
import { getNetworkStatusMonitor } from '$lib/shared/sync/getNetworkStatusMonitor';
import { getGalleryOfflineCache } from './getGalleryOfflineCache';
import { getThumbnailLocalCache } from '$lib/features/browse/sequences/display/getThumbnailLocalCache';

let instance: IOfflineCacheOrchestrator | null = null;
export function getOfflineCacheOrchestrator(): IOfflineCacheOrchestrator {
  return instance ??= new OfflineCacheOrchestrator(
    getNetworkStatusMonitor(),
    getGalleryOfflineCache(),
    getThumbnailLocalCache()
  );
}
