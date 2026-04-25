import { browser } from '$app/environment';
import type { IAnnouncementManager } from './services/contracts/IAnnouncementManager';
import { AnnouncementManager } from './services/implementations/AnnouncementManager';

let instance: IAnnouncementManager | null = null;

export function getAnnouncementManager(): IAnnouncementManager {
	if (!browser) throw new Error('getAnnouncementManager() is browser-only');
	return instance ??= new AnnouncementManager();
}
