import { browser } from '$app/environment';

import { ScreenshotOrchestrator } from './services/implementations/ScreenshotOrchestrator';

let instance: ScreenshotOrchestrator | null = null;

export function getScreenshotOrchestrator(): ScreenshotOrchestrator {
	if (!browser) throw new Error('getScreenshotOrchestrator() is browser-only');
	return instance ??= new ScreenshotOrchestrator();
}
