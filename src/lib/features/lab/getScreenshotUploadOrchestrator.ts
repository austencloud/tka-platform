import { browser } from '$app/environment';
import type { IScreenshotUploadOrchestrator } from './services/contracts/IScreenshotUploadOrchestrator';
import { ScreenshotUploadOrchestrator } from './services/implementations/ScreenshotUploadOrchestrator';
import { getScreenshotUploader } from './getScreenshotUploader';
import { getScreenshotOrchestrator } from './getScreenshotOrchestrator';
import { getScreenshotLoader } from './getScreenshotLoader';

let instance: IScreenshotUploadOrchestrator | null = null;

export function getScreenshotUploadOrchestrator(): IScreenshotUploadOrchestrator {
	if (!browser) throw new Error('getScreenshotUploadOrchestrator() is browser-only');
	return instance ??= new ScreenshotUploadOrchestrator(
		getScreenshotUploader(),
		getScreenshotOrchestrator(),
		getScreenshotLoader(),
	);
}
