import { browser } from '$app/environment';
import { StartPositionManager } from '$lib/shared/create/services/StartPositionManager';

let instance: StartPositionManager | null = null;

export function getStartPositionManager(): StartPositionManager {
	if (!browser) throw new Error('getStartPositionManager() is browser-only');
	return instance ??= new StartPositionManager();
}
