import { browser } from '$app/environment';
import type { IScreenshotOrchestrator } from './services/contracts/IScreenshotOrchestrator';
import { ScreenshotOrchestrator } from './services/implementations/ScreenshotOrchestrator';

let instance: IScreenshotOrchestrator | null = null;

export function getScreenshotOrchestrator(): IScreenshotOrchestrator {
	if (!browser) throw new Error('getScreenshotOrchestrator() is browser-only');
	return instance ??= new ScreenshotOrchestrator();
}
