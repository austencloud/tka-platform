import { browser } from '$app/environment';

import { PerformanceHistoryTracker } from './services/implementations/PerformanceHistoryTracker';

let instance: PerformanceHistoryTracker | null = null;

export function getPerformanceHistoryTracker(): PerformanceHistoryTracker {
	if (!browser) throw new Error('getPerformanceHistoryTracker() is browser-only');
	return instance ??= new PerformanceHistoryTracker();
}
