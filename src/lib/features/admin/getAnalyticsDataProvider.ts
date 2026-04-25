import { browser } from '$app/environment';
import type { IAnalyticsDataProvider } from './services/contracts/IAnalyticsDataProvider';
import { AnalyticsDataProvider } from './services/implementations/AnalyticsDataProvider';
import { getUserMetricsAnalyzer } from './getUserMetricsAnalyzer';
import { getEventActivityAnalyzer } from './getEventActivityAnalyzer';
import { getContentQueryAnalyzer } from './getContentQueryAnalyzer';

let instance: IAnalyticsDataProvider | null = null;

export function getAnalyticsDataProvider(): IAnalyticsDataProvider {
	if (!browser) throw new Error('getAnalyticsDataProvider() is browser-only');
	return instance ??= new AnalyticsDataProvider(
		getUserMetricsAnalyzer(),
		getEventActivityAnalyzer(),
		getContentQueryAnalyzer(),
	);
}
