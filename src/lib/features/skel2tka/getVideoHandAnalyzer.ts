import { browser } from '$app/environment';
import { VideoHandAnalyzer } from './services/implementations/VideoHandAnalyzer';
import { getImageModeHandLandmarker } from './getImageModeHandLandmarker';

let instance: VideoHandAnalyzer | null = null;

export function getVideoHandAnalyzer(): VideoHandAnalyzer {
	if (!browser) throw new Error('getVideoHandAnalyzer() is browser-only');
	return instance ??= new VideoHandAnalyzer(getImageModeHandLandmarker());
}
