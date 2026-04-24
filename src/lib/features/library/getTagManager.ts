import { browser } from '$app/environment';
import type { ITagManager } from './services/contracts/ITagManager';
import { TagManager } from './services/implementations/TagManager';

let instance: ITagManager | null = null;

export function getTagManager(): ITagManager {
	if (!browser) throw new Error('getTagManager() is browser-only');
	return instance ??= new TagManager();
}
