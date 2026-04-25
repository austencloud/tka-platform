import { browser } from '$app/environment';
import type { IStartPositionManager } from './services/contracts/IStartPositionManager';
import { StartPositionManager } from './services/implementations/StartPositionManager';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';

let instance: IStartPositionManager | null = null;

export function getStartPositionManager(): IStartPositionManager {
	if (!browser) throw new Error('getStartPositionManager() is browser-only');
	return instance ??= new StartPositionManager(gridPositionDeriver);
}
