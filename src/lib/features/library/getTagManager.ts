import { browser } from '$app/environment';
import { TagManager } from './services/implementations/TagManager';

let instance: TagManager | null = null;

export function getTagManager(): TagManager {
	if (!browser) throw new Error('getTagManager() is browser-only');
	return instance ??= new TagManager();
}
