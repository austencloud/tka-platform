import { browser } from '$app/environment';
import type { IVideoCountManager } from './services/contracts/IVideoCountManager';
import { VideoCountManager } from './services/implementations/VideoCountManager';
import { getCollaborativeVideoManager } from '$lib/shared/video-collaboration/getCollaborativeVideoManager';

let instance: IVideoCountManager | null = null;

export function getVideoCountManager(): IVideoCountManager {
	if (!browser) throw new Error('getVideoCountManager() is browser-only');
	return instance ??= new VideoCountManager(getCollaborativeVideoManager());
}
