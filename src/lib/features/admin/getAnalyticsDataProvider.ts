import { browser } from '$app/environment';
import { AnalyticsDataProvider } from './services/implementations/AnalyticsDataProvider';
import { getUserMetricsAnalyzer } from './getUserMetricsAnalyzer';
import { getEventActivityAnalyzer } from './getEventActivityAnalyzer';
import { getContentQueryAnalyzer } from './getContentQueryAnalyzer';

let instance: AnalyticsDataProvider | null = null;

export function getAnalyticsDataProvider(): AnalyticsDataProvider {
	if (!browser) throw new Error('getAnalyticsDataProvider() is browser-only');
	return instance ??= new AnalyticsDataProvider(
		getUserMetricsAnalyzer(),
		getEventActivityAnalyzer(),
		getContentQueryAnalyzer(),
	);
}
