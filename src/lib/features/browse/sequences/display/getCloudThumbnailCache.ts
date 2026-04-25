import { browser } from '$app/environment';
import type { ICloudThumbnailCache } from './services/contracts/ICloudThumbnailCache';
import { CloudThumbnailCache } from './services/implementations/CloudThumbnailCache';

let instance: ICloudThumbnailCache | null = null;

export function getCloudThumbnailCache(): ICloudThumbnailCache {
	if (!browser) throw new Error('getCloudThumbnailCache() is browser-only');
	return instance ??= new CloudThumbnailCache();
}
