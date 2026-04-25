import { browser } from '$app/environment';
import type { IThumbnailRenderOrchestrator } from './services/contracts/IThumbnailRenderOrchestrator';
import { ThumbnailRenderOrchestrator } from './services/implementations/ThumbnailRenderOrchestrator';
import { getThumbnailKeyDeriver } from './getThumbnailKeyDeriver';
import { getThumbnailRenderQueue } from './getThumbnailRenderQueue';
import { getThumbnailRenderer } from './getThumbnailRenderer';
import { getCloudThumbnailCache } from './getCloudThumbnailCache';
import { getThumbnailLocalCache } from './getThumbnailLocalCache';
import { getThumbnailMetricsCollector } from './getThumbnailMetricsCollector';

let instance: IThumbnailRenderOrchestrator | null = null;

export function getThumbnailRenderOrchestrator(): IThumbnailRenderOrchestrator {
	if (!browser) throw new Error('getThumbnailRenderOrchestrator() is browser-only');
	return instance ??= new ThumbnailRenderOrchestrator(
		getThumbnailKeyDeriver(),
		getThumbnailRenderQueue(),
		getThumbnailRenderer(),
		getCloudThumbnailCache(),
		getThumbnailLocalCache(),
		getThumbnailMetricsCollector(),
	);
}
