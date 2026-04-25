import { browser } from '$app/environment';
import type { IVideoFrameExtractor } from './services/contracts/IVideoFrameExtractor';
import { VideoFrameExtractor } from './services/implementations/VideoFrameExtractor';

let instance: IVideoFrameExtractor | null = null;

export function getVideoFrameExtractor(): IVideoFrameExtractor {
	if (!browser) throw new Error('getVideoFrameExtractor() is browser-only');
	return instance ??= new VideoFrameExtractor();
}
