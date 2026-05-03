import { browser } from '$app/environment';
import { MediaBundler } from './services/implementations/MediaBundler';
import { getSharer } from './getSharer';

let instance: MediaBundler | null = null;

export function getMediaBundler(): MediaBundler {
	if (!browser) throw new Error('getMediaBundler() is browser-only');
	return instance ??= new MediaBundler(getSharer());
}
