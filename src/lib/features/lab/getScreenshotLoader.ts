import { browser } from '$app/environment';
import { ScreenshotLoader } from './services/implementations/ScreenshotLoader';

let instance: ScreenshotLoader | null = null;

export function getScreenshotLoader(): ScreenshotLoader {
	if (!browser) throw new Error('getScreenshotLoader() is browser-only');
	return instance ??= new ScreenshotLoader();
}
