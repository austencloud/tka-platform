import { browser } from '$app/environment';

import { UserDocumentManager } from './services/implementations/UserDocumentManager';

let instance: UserDocumentManager | null = null;

export function getUserDocumentManager(): UserDocumentManager {
	if (!browser) throw new Error('getUserDocumentManager() is browser-only');
	return instance ??= new UserDocumentManager();
}
