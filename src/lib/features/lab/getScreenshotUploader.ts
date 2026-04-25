import { browser } from '$app/environment';
import type { IScreenshotUploader } from './services/contracts/IScreenshotUploader';
import { ScreenshotUploader } from './services/implementations/ScreenshotUploader';

let instance: IScreenshotUploader | null = null;

export function getScreenshotUploader(): IScreenshotUploader {
	if (!browser) throw new Error('getScreenshotUploader() is browser-only');
	return instance ??= new ScreenshotUploader();
}
