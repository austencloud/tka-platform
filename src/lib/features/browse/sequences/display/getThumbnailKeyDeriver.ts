import { browser } from '$app/environment';
import type { IThumbnailKeyDeriver } from './services/contracts/IThumbnailKeyDeriver';
import { ThumbnailKeyDeriver } from './services/implementations/ThumbnailKeyDeriver';

let instance: IThumbnailKeyDeriver | null = null;

export function getThumbnailKeyDeriver(): IThumbnailKeyDeriver {
	if (!browser) throw new Error('getThumbnailKeyDeriver() is browser-only');
	return instance ??= new ThumbnailKeyDeriver();
}
