import { browser } from '$app/environment';
import type { IContentModerator } from './services/contracts/IContentModerator';
import { ContentModerator } from './services/implementations/ContentModerator';

let instance: IContentModerator | null = null;

export function getContentModerator(): IContentModerator {
	if (!browser) throw new Error('getContentModerator() is browser-only');
	return instance ??= new ContentModerator();
}
