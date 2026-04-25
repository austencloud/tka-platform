import { browser } from '$app/environment';
import type { IPolyrhythmicDetector } from './services/contracts/IPolyrhythmicDetector';
import { PolyrhythmicDetector } from './services/implementations/PolyrhythmicDetector';

let instance: IPolyrhythmicDetector | null = null;

export function getPolyrhythmicDetector(): IPolyrhythmicDetector {
	if (!browser) throw new Error('getPolyrhythmicDetector() is browser-only');
	return instance ??= new PolyrhythmicDetector();
}
