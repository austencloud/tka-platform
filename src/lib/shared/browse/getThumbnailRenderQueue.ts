import { browser } from '$app/environment';
import { ThumbnailRenderQueue } from './services/ThumbnailRenderQueue';
import { CompositionDispatcher } from '$lib/shared/render/services/composition-dispatcher';

let instance: ThumbnailRenderQueue | null = null;

export function getThumbnailRenderQueue(): ThumbnailRenderQueue {
	if (!browser) throw new Error('getThumbnailRenderQueue() is browser-only');
	if (!instance) {
		instance = new ThumbnailRenderQueue();
		// Workers handle the heavy lifting — pipeline more tasks.
		// Without workers, limit to reduce main-thread pressure.
		const POOL_SIZE = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 4));
		const max = CompositionDispatcher.canUseWorker() ? Math.min(POOL_SIZE * 2, 8) : 3;
		instance.setMaxConcurrent(max);
	}
	return instance;
}
