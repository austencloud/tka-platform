import { browser } from '$app/environment';

import { VideoFrameExtractor } from './services/implementations/VideoFrameExtractor';

let instance: VideoFrameExtractor | null = null;

export function getVideoFrameExtractor(): VideoFrameExtractor {
	if (!browser) throw new Error('getVideoFrameExtractor() is browser-only');
	return instance ??= new VideoFrameExtractor();
}
