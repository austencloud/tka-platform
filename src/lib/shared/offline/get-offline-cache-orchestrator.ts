import { OfflineCacheOrchestrator } from './services/offline-cache-orchestrator';
import { getNetworkStatusMonitor } from '$lib/shared/sync/get-network-status-monitor';
import { getGalleryOfflineCache } from './get-gallery-offline-cache';
import { getThumbnailLocalCache } from '$lib/shared/browse/getThumbnailLocalCache';

let instance: OfflineCacheOrchestrator | null = null;
export function getOfflineCacheOrchestrator(): OfflineCacheOrchestrator {
  return instance ??= new OfflineCacheOrchestrator(
    getNetworkStatusMonitor(),
    getGalleryOfflineCache(),
    getThumbnailLocalCache()
  );
}
