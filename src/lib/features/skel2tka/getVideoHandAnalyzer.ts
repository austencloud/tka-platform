import { browser } from '$app/environment';
import type { IVideoHandAnalyzer } from './services/contracts/IVideoHandAnalyzer';
import { VideoHandAnalyzer } from './services/implementations/VideoHandAnalyzer';
import { getImageModeHandLandmarker } from './getImageModeHandLandmarker';

let instance: IVideoHandAnalyzer | null = null;

export function getVideoHandAnalyzer(): IVideoHandAnalyzer {
	if (!browser) throw new Error('getVideoHandAnalyzer() is browser-only');
	return instance ??= new VideoHandAnalyzer(getImageModeHandLandmarker());
}
