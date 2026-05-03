import { browser } from '$app/environment';
import { ContentAppealManager } from './services/implementations/ContentAppealManager';

let instance: ContentAppealManager | null = null;

export function getContentAppealManager(): ContentAppealManager {
	if (!browser) throw new Error('getContentAppealManager() is browser-only');
	return instance ??= new ContentAppealManager();
}
