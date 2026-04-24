import { browser } from '$app/environment';
import type { IUserDocumentManager } from './services/contracts/IUserDocumentManager';
import { UserDocumentManager } from './services/implementations/UserDocumentManager';
import { getProfilePictureManager } from './getProfilePictureManager';
import { getUsernameValidator } from './getUsernameValidator';

let instance: IUserDocumentManager | null = null;

export function getUserDocumentManager(): IUserDocumentManager {
	if (!browser) throw new Error('getUserDocumentManager() is browser-only');
	return instance ??= new UserDocumentManager(getProfilePictureManager(), getUsernameValidator());
}
