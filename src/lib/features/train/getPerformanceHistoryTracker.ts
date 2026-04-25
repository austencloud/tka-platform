import { browser } from '$app/environment';
import type { IPerformanceHistoryTracker } from './services/contracts/IPerformanceHistoryTracker';
import { PerformanceHistoryTracker } from './services/implementations/PerformanceHistoryTracker';

let instance: IPerformanceHistoryTracker | null = null;

export function getPerformanceHistoryTracker(): IPerformanceHistoryTracker {
	if (!browser) throw new Error('getPerformanceHistoryTracker() is browser-only');
	return instance ??= new PerformanceHistoryTracker();
}
