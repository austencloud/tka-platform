import { browser } from '$app/environment';
import type { IWebviewDetector } from './services/contracts/IWebviewDetector';
import { WebviewDetector } from './services/implementations/WebviewDetector';

let instance: IWebviewDetector | null = null;

export function getWebviewDetector(): IWebviewDetector {
	if (!browser) throw new Error('getWebviewDetector() is browser-only');
	return instance ??= new WebviewDetector();
}
