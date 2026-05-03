import { browser } from '$app/environment';
import { CloudThumbnailCache } from './services/implementations/CloudThumbnailCache';

let instance: CloudThumbnailCache | null = null;

export function getCloudThumbnailCache(): CloudThumbnailCache {
	if (!browser) throw new Error('getCloudThumbnailCache() is browser-only');
	return instance ??= new CloudThumbnailCache();
}
