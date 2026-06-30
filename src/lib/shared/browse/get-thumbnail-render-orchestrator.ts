import { browser } from '$app/environment';
import { ThumbnailRenderOrchestrator } from '$lib/shared/browse/services/thumbnail-render-orchestrator';
import { getThumbnailRenderQueue } from '$lib/shared/browse/get-thumbnail-render-queue';
import { getThumbnailRenderer } from '$lib/shared/browse/get-thumbnail-renderer';
import { getThumbnailLocalCache } from '$lib/shared/browse/get-thumbnail-local-cache';
import { getThumbnailMetricsCollector } from '$lib/shared/browse/get-thumbnail-metrics-collector';

// Preserve the orchestrator across HMR so its warm in-memory URL cache (the only
// zero-flash tier) survives a dev file save. Blob URLs stay valid across HMR
// (no document reload), so the preserved Map keeps revisited thumbnails instant
// instead of forcing a fresh render pass on every save. Mirrors auth-state's
// import.meta.hot.data pattern.
let instance: ThumbnailRenderOrchestrator | null =
	(import.meta.hot?.data?.orchestrator as ThumbnailRenderOrchestrator | undefined) ?? null;

if (import.meta.hot) {
	import.meta.hot.dispose((data) => {
		data.orchestrator = instance;
	});
}

export function getThumbnailRenderOrchestrator(): ThumbnailRenderOrchestrator {
	if (!browser) throw new Error('getThumbnailRenderOrchestrator() is browser-only');
	return instance ??= new ThumbnailRenderOrchestrator(
		getThumbnailRenderQueue(),
		getThumbnailRenderer(),
		getThumbnailLocalCache(),
		getThumbnailMetricsCollector(),
	);
}
