import { browser } from '$app/environment';
import { ScreenshotInjector } from './services/implementations/ScreenshotInjector';

let instance: ScreenshotInjector | null = null;

export function getScreenshotInjector(): ScreenshotInjector {
	if (!browser) throw new Error('getScreenshotInjector() is browser-only');
	return instance ??= new ScreenshotInjector();
}
