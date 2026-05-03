import { browser } from '$app/environment';

import { ScreenshotUploader } from './services/implementations/ScreenshotUploader';

let instance: ScreenshotUploader | null = null;

export function getScreenshotUploader(): ScreenshotUploader {
	if (!browser) throw new Error('getScreenshotUploader() is browser-only');
	return instance ??= new ScreenshotUploader();
}
