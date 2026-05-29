import { browser } from '$app/environment';
import { GestureHandler } from './services/gesture-handler';

let instance: GestureHandler | null = null;

export function getGestureHandler(): GestureHandler {
	if (!browser) throw new Error('getGestureHandler() is browser-only');
	return instance ??= new GestureHandler();
}
