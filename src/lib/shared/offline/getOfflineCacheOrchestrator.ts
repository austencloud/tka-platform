import { OfflineCacheOrchestrator } from './services/implementations/OfflineCacheOrchestrator';
import { getNetworkStatusMonitor } from '$lib/shared/sync/getNetworkStatusMonitor';
import { getGalleryOfflineCache } from './getGalleryOfflineCache';
import { getThumbnailLocalCache } from '$lib/shared/browse/getThumbnailLocalCache';

let instance: OfflineCacheOrchestrator | null = null;
export function getOfflineCacheOrchestrator(): OfflineCacheOrchestrator {
  return instance ??= new OfflineCacheOrchestrator(
    getNetworkStatusMonitor(),
    getGalleryOfflineCache(),
    getThumbnailLocalCache()
  );
}
