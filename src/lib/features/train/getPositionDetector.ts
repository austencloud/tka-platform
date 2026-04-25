import { browser } from '$app/environment';
import type { IPositionDetector } from './services/contracts/IPositionDetector';
import { MediaPipeDetector } from './services/implementations/MediaPipeDetector';
import { getHandLandmarker } from './getHandLandmarker';
import { getHandednessAnalyzer } from './getHandednessAnalyzer';
import { getHandStateAnalyzer } from './getHandStateAnalyzer';
import { getHandTrackingStabilizer } from './getHandTrackingStabilizer';

let instance: IPositionDetector | null = null;

export function getPositionDetector(): IPositionDetector {
	if (!browser) throw new Error('getPositionDetector() is browser-only');
	return instance ??= new MediaPipeDetector(
		getHandLandmarker(),
		getHandednessAnalyzer(),
		getHandStateAnalyzer(),
		getHandTrackingStabilizer(),
	);
}
