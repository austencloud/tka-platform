import { browser } from '$app/environment';
import { ThumbnailRenderOrchestrator } from '$lib/features/browse/sequences/display/services/implementations/ThumbnailRenderOrchestrator';
import { getThumbnailRenderQueue } from '$lib/features/browse/sequences/display/getThumbnailRenderQueue';
import { getThumbnailRenderer } from '$lib/features/browse/sequences/display/getThumbnailRenderer';
import { getThumbnailLocalCache } from '$lib/shared/browse/getThumbnailLocalCache';
import { getThumbnailMetricsCollector } from '$lib/features/browse/sequences/display/getThumbnailMetricsCollector';

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
