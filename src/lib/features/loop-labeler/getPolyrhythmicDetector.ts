import { browser } from '$app/environment';
import { PolyrhythmicDetector } from './services/implementations/PolyrhythmicDetector';

let instance: PolyrhythmicDetector | null = null;

export function getPolyrhythmicDetector(): PolyrhythmicDetector {
	if (!browser) throw new Error('getPolyrhythmicDetector() is browser-only');
	return instance ??= new PolyrhythmicDetector();
}
