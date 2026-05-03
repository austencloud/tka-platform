import { browser } from '$app/environment';
import { ImageModeHandLandmarker } from './services/implementations/ImageModeHandLandmarker';

let instance: ImageModeHandLandmarker | null = null;

export function getImageModeHandLandmarker(): ImageModeHandLandmarker {
	if (!browser) throw new Error('getImageModeHandLandmarker() is browser-only');
	return instance ??= new ImageModeHandLandmarker();
}
