import { browser } from '$app/environment';
import type { IThumbnailRenderQueue } from './services/contracts/IThumbnailRenderQueue';
import { ThumbnailRenderQueue } from './services/implementations/ThumbnailRenderQueue';

let instance: IThumbnailRenderQueue | null = null;

export function getThumbnailRenderQueue(): IThumbnailRenderQueue {
	if (!browser) throw new Error('getThumbnailRenderQueue() is browser-only');
	return instance ??= new ThumbnailRenderQueue();
}
