import { browser } from '$app/environment';
import type { ICanvasManager } from './services/contracts/ICanvasManager';
import { CanvasManager } from './services/implementations/CanvasManager';

let instance: ICanvasManager | null = null;

export function getCanvasManager(): ICanvasManager {
	if (!browser) throw new Error('getCanvasManager() is browser-only');
	return instance ??= new CanvasManager();
}
