import { browser } from '$app/environment';
import type { IBeatBoundaryDetector } from './services/contracts/IBeatBoundaryDetector';
import { BeatBoundaryDetector } from './services/implementations/BeatBoundaryDetector';

let instance: IBeatBoundaryDetector | null = null;

export function getBeatBoundaryDetector(): IBeatBoundaryDetector {
	if (!browser) throw new Error('getBeatBoundaryDetector() is browser-only');
	return instance ??= new BeatBoundaryDetector();
}
