import { browser } from '$app/environment';
import { SystemStateManager } from './services/implementations/SystemStateManager';
import { getActivityLogger } from '$lib/shared/analytics/getActivityLogger';

let instance: SystemStateManager | null = null;

export function getSystemStateManager(): SystemStateManager {
	if (!browser) throw new Error('getSystemStateManager() is browser-only');
	return instance ??= new SystemStateManager(getActivityLogger());
}
