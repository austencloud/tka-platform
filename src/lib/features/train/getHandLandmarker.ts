import { browser } from '$app/environment';
import type { IHandLandmarker } from './services/contracts/IHandLandmarker';
import { HandLandmarker } from './services/implementations/HandLandmarker';

let instance: IHandLandmarker | null = null;

export function getHandLandmarker(): IHandLandmarker {
	if (!browser) throw new Error('getHandLandmarker() is browser-only');
	return instance ??= new HandLandmarker();
}
