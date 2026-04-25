import { browser } from '$app/environment';
import type { IContentAppealManager } from './services/contracts/IContentAppealManager';
import { ContentAppealManager } from './services/implementations/ContentAppealManager';

let instance: IContentAppealManager | null = null;

export function getContentAppealManager(): IContentAppealManager {
	if (!browser) throw new Error('getContentAppealManager() is browser-only');
	return instance ??= new ContentAppealManager();
}
