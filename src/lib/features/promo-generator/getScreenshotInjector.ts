import { browser } from '$app/environment';
import type { IScreenshotInjector } from './services/contracts/IScreenshotInjector';
import { ScreenshotInjector } from './services/implementations/ScreenshotInjector';

let instance: IScreenshotInjector | null = null;

export function getScreenshotInjector(): IScreenshotInjector {
	if (!browser) throw new Error('getScreenshotInjector() is browser-only');
	return instance ??= new ScreenshotInjector();
}
