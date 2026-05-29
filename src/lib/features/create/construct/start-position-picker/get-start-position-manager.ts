import { browser } from '$app/environment';
import { StartPositionManager } from '$lib/shared/create/services/StartPositionManager';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';

let instance: StartPositionManager | null = null;

export function getStartPositionManager(): StartPositionManager {
	if (!browser) throw new Error('getStartPositionManager() is browser-only');
	return instance ??= new StartPositionManager(gridPositionDeriver);
}
