import { browser } from '$app/environment';
import type { IMediaBundler } from './services/contracts/IMediaBundler';
import { MediaBundler } from './services/implementations/MediaBundler';
import { getSharer } from './getSharer';

let instance: IMediaBundler | null = null;

export function getMediaBundler(): IMediaBundler {
	if (!browser) throw new Error('getMediaBundler() is browser-only');
	return instance ??= new MediaBundler(getSharer());
}
