import { browser } from '$app/environment';
import type { IPWAEngagementTracker } from './services/contracts/IPWAEngagementTracker';
import { PWAEngagementTracker } from './services/implementations/PWAEngagementTracker';

let instance: IPWAEngagementTracker | null = null;

export function getPWAEngagementTracker(): IPWAEngagementTracker {
	if (!browser) throw new Error('getPWAEngagementTracker() is browser-only');
	return instance ??= new PWAEngagementTracker();
}
