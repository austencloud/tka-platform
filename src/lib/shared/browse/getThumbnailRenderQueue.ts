import { browser } from '$app/environment';
import { ThumbnailRenderQueue } from './services/ThumbnailRenderQueue';

let instance: ThumbnailRenderQueue | null = null;

export function getThumbnailRenderQueue(): ThumbnailRenderQueue {
	if (!browser) throw new Error('getThumbnailRenderQueue() is browser-only');
	return instance ??= new ThumbnailRenderQueue();
}
