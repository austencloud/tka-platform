import { browser } from '$app/environment';
import type { IImageModeHandLandmarker } from './services/contracts/IImageModeHandLandmarker';
import { ImageModeHandLandmarker } from './services/implementations/ImageModeHandLandmarker';

let instance: IImageModeHandLandmarker | null = null;

export function getImageModeHandLandmarker(): IImageModeHandLandmarker {
	if (!browser) throw new Error('getImageModeHandLandmarker() is browser-only');
	return instance ??= new ImageModeHandLandmarker();
}
