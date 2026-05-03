import { browser } from '$app/environment';

import { MediaPipeDetector } from './services/implementations/MediaPipeDetector';
import { getHandLandmarker } from './getHandLandmarker';
import { getHandednessAnalyzer } from './getHandednessAnalyzer';
import { getHandStateAnalyzer } from './getHandStateAnalyzer';
import { getHandTrackingStabilizer } from './getHandTrackingStabilizer';

let instance: MediaPipeDetector | null = null;

export function getPositionDetector(): MediaPipeDetector {
	if (!browser) throw new Error('getPositionDetector() is browser-only');
	return instance ??= new MediaPipeDetector(
		getHandLandmarker(),
		getHandednessAnalyzer(),
		getHandStateAnalyzer(),
		getHandTrackingStabilizer(),
	);
}
