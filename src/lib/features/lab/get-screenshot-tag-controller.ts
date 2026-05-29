import { browser } from '$app/environment';
import { ScreenshotTagController } from './services/screenshot-tag-controller';

let instance: ScreenshotTagController | null = null;

export function getScreenshotTagController(): ScreenshotTagController {
	if (!browser) throw new Error('getScreenshotTagController() is browser-only');
	return instance ??= new ScreenshotTagController();
}
