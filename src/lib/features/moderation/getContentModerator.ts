import { browser } from '$app/environment';
import { ContentModerator } from './services/implementations/ContentModerator';

let instance: ContentModerator | null = null;

export function getContentModerator(): ContentModerator {
	if (!browser) throw new Error('getContentModerator() is browser-only');
	return instance ??= new ContentModerator();
}
