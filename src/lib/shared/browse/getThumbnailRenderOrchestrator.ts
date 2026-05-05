import { browser } from '$app/environment';
import { ThumbnailRenderOrchestrator } from '$lib/shared/browse/services/ThumbnailRenderOrchestrator';
import { getThumbnailRenderQueue } from '$lib/shared/browse/getThumbnailRenderQueue';
import { getThumbnailRenderer } from '$lib/shared/browse/getThumbnailRenderer';
import { getThumbnailLocalCache } from '$lib/shared/browse/getThumbnailLocalCache';
import { getThumbnailMetricsCollector } from '$lib/shared/browse/getThumbnailMetricsCollector';

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
