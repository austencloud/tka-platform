import { browser } from '$app/environment';
import type { ISystemStateManager } from './services/contracts/ISystemStateManager';
import { SystemStateManager } from './services/implementations/SystemStateManager';
import { getActivityLogger } from '$lib/shared/analytics/getActivityLogger';

let instance: ISystemStateManager | null = null;

export function getSystemStateManager(): ISystemStateManager {
	if (!browser) throw new Error('getSystemStateManager() is browser-only');
	return instance ??= new SystemStateManager(getActivityLogger());
}
