import { browser } from '$app/environment';
import { CollaborativeVideoManager } from './services/implementations/CollaborativeVideoManager';

let instance: CollaborativeVideoManager | null = null;

export function getCollaborativeVideoManager(): CollaborativeVideoManager {
	if (!browser) throw new Error('getCollaborativeVideoManager() is browser-only');
	return instance ??= new CollaborativeVideoManager();
}
