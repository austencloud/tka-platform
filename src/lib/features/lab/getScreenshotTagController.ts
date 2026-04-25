import { browser } from '$app/environment';
import type { IScreenshotTagController } from './services/contracts/IScreenshotTagController';
import { ScreenshotTagController } from './services/implementations/ScreenshotTagController';

let instance: IScreenshotTagController | null = null;

export function getScreenshotTagController(): IScreenshotTagController {
	if (!browser) throw new Error('getScreenshotTagController() is browser-only');
	return instance ??= new ScreenshotTagController();
}
