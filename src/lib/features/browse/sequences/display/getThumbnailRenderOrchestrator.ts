import { browser } from '$app/environment';
import { ThumbnailRenderOrchestrator } from './services/implementations/ThumbnailRenderOrchestrator';
import { getThumbnailRenderQueue } from './getThumbnailRenderQueue';
import { getThumbnailRenderer } from './getThumbnailRenderer';
import { getThumbnailLocalCache } from './getThumbnailLocalCache';
import { getThumbnailMetricsCollector } from './getThumbnailMetricsCollector';

let instance: ThumbnailRenderOrchestrator | null = null;

export function getThumbnailRenderOrchestrator(): ThumbnailRenderOrchestrator {
	if (!browser) throw new Error('getThumbnailRenderOrchestrator() is browser-only');
	return instance ??= new ThumbnailRenderOrchestrator(
		getThumbnailRenderQueue(),
		getThumbnailRenderer(),
		getThumbnailLocalCache(),
		getThumbnailMetricsCollector(),
	);
}
