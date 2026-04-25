import { browser } from '$app/environment';
import type { ICollaborativeVideoManager } from './services/contracts/ICollaborativeVideoManager';
import { CollaborativeVideoManager } from './services/implementations/CollaborativeVideoManager';

let instance: ICollaborativeVideoManager | null = null;

export function getCollaborativeVideoManager(): ICollaborativeVideoManager {
	if (!browser) throw new Error('getCollaborativeVideoManager() is browser-only');
	return instance ??= new CollaborativeVideoManager();
}
