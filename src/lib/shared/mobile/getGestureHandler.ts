import { browser } from '$app/environment';
import type { IGestureHandler } from './services/contracts/IGestureHandler';
import { GestureHandler } from './services/implementations/GestureHandler';

let instance: IGestureHandler | null = null;

export function getGestureHandler(): IGestureHandler {
	if (!browser) throw new Error('getGestureHandler() is browser-only');
	return instance ??= new GestureHandler();
}
