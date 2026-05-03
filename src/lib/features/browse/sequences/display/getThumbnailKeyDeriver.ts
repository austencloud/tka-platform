import { browser } from '$app/environment';
import { ThumbnailKeyDeriver } from './services/implementations/ThumbnailKeyDeriver';

let instance: ThumbnailKeyDeriver | null = null;

export function getThumbnailKeyDeriver(): ThumbnailKeyDeriver {
	if (!browser) throw new Error('getThumbnailKeyDeriver() is browser-only');
	return instance ??= new ThumbnailKeyDeriver();
}
