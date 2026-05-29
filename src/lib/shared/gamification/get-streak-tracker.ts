import { browser } from '$app/environment';

import { StreakTracker } from './services/streak-tracker';

let instance: StreakTracker | null = null;

export function getStreakTracker(): StreakTracker {
	if (!browser) throw new Error('getStreakTracker() is browser-only');
	return instance ??= new StreakTracker();
}
