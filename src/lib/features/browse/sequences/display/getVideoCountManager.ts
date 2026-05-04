import { browser } from '$app/environment';

import { VideoCountManager } from './services/implementations/VideoCountManager';

let instance: VideoCountManager | null = null;

export function getVideoCountManager(): VideoCountManager {
	if (!browser) throw new Error('getVideoCountManager() is browser-only');
	return instance ??= new VideoCountManager();
}
