import { browser } from '$app/environment';

import { CanvasManager } from './services/canvas-manager';

let instance: CanvasManager | null = null;

export function getCanvasManager(): CanvasManager {
	if (!browser) throw new Error('getCanvasManager() is browser-only');
	return instance ??= new CanvasManager();
}
