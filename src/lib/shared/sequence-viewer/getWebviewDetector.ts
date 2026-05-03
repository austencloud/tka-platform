import { browser } from '$app/environment';
import { WebviewDetector } from './services/implementations/WebviewDetector';

let instance: WebviewDetector | null = null;

export function getWebviewDetector(): WebviewDetector {
	if (!browser) throw new Error('getWebviewDetector() is browser-only');
	return instance ??= new WebviewDetector();
}
