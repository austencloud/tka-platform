import { browser } from '$app/environment';
import type { IScreenshotLoader } from './services/contracts/IScreenshotLoader';
import { ScreenshotLoader } from './services/implementations/ScreenshotLoader';

let instance: IScreenshotLoader | null = null;

export function getScreenshotLoader(): IScreenshotLoader {
	if (!browser) throw new Error('getScreenshotLoader() is browser-only');
	return instance ??= new ScreenshotLoader();
}
