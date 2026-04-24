import { browser } from '$app/environment';
import type { IProfilePictureManager } from './services/contracts/IProfilePictureManager';
import { ProfilePictureManager } from './services/implementations/ProfilePictureManager';

let instance: IProfilePictureManager | null = null;

export function getProfilePictureManager(): IProfilePictureManager {
	if (!browser) throw new Error('getProfilePictureManager() is browser-only');
	return instance ??= new ProfilePictureManager();
}
