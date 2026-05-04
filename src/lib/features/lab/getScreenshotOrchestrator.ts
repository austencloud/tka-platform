import { browser } from '$app/environment';

import * as screenshotOrchestrator from './services/screenshot-orchestrator';

export function getScreenshotOrchestrator() {
	if (!browser) throw new Error('getScreenshotOrchestrator() is browser-only');
	return screenshotOrchestrator;
}
