import { browser } from '$app/environment';
import { ThumbnailRenderOrchestrator } from '$lib/shared/browse/services/thumbnail-render-orchestrator';
import { getThumbnailRenderQueue } from '$lib/shared/browse/get-thumbnail-render-queue';
import { getThumbnailRenderer } from '$lib/shared/browse/get-thumbnail-renderer';
import { getThumbnailLocalCache } from '$lib/shared/browse/get-thumbnail-local-cache';
import { getThumbnailMetricsCollector } from '$lib/shared/browse/get-thumbnail-metrics-collector';

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
