import { browser } from '$app/environment';
import { ProfilePictureManager } from './services/implementations/ProfilePictureManager';

let instance: ProfilePictureManager | null = null;

export function getProfilePictureManager(): ProfilePictureManager {
	if (!browser) throw new Error('getProfilePictureManager() is browser-only');
	return instance ??= new ProfilePictureManager();
}
