import { browser } from '$app/environment';
import { UserMetricsAnalyzer } from './services/implementations/UserMetricsAnalyzer';
import { getSystemStateManager } from './getSystemStateManager';

let instance: UserMetricsAnalyzer | null = null;

export function getUserMetricsAnalyzer(): UserMetricsAnalyzer {
	if (!browser) throw new Error('getUserMetricsAnalyzer() is browser-only');
	return instance ??= new UserMetricsAnalyzer(getSystemStateManager());
}
