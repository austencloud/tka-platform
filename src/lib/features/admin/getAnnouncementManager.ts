import { browser } from '$app/environment';

import { AnnouncementManager } from './services/implementations/AnnouncementManager';

let instance: AnnouncementManager | null = null;

export function getAnnouncementManager(): AnnouncementManager {
	if (!browser) throw new Error('getAnnouncementManager() is browser-only');
	return instance ??= new AnnouncementManager();
}
