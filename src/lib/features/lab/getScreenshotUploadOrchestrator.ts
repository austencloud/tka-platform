import { browser } from '$app/environment';

import { ScreenshotUploadOrchestrator } from './services/implementations/ScreenshotUploadOrchestrator';
import { getScreenshotUploader } from './getScreenshotUploader';
import { getScreenshotOrchestrator } from './getScreenshotOrchestrator';
import { getScreenshotLoader } from './getScreenshotLoader';

let instance: ScreenshotUploadOrchestrator | null = null;

export function getScreenshotUploadOrchestrator(): ScreenshotUploadOrchestrator {
	if (!browser) throw new Error('getScreenshotUploadOrchestrator() is browser-only');
	return instance ??= new ScreenshotUploadOrchestrator(
		getScreenshotUploader(),
		getScreenshotOrchestrator(),
		getScreenshotLoader(),
	);
}
