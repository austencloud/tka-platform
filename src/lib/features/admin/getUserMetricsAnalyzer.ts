import { browser } from '$app/environment';
import type { IUserMetricsAnalyzer } from './services/implementations/UserMetricsAnalyzer';
import { UserMetricsAnalyzer } from './services/implementations/UserMetricsAnalyzer';
import { getSystemStateManager } from './getSystemStateManager';

let instance: IUserMetricsAnalyzer | null = null;

export function getUserMetricsAnalyzer(): IUserMetricsAnalyzer {
	if (!browser) throw new Error('getUserMetricsAnalyzer() is browser-only');
	return instance ??= new UserMetricsAnalyzer(getSystemStateManager());
}
