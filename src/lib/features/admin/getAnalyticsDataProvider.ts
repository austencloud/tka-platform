import { browser } from '$app/environment';
import { AnalyticsDataProvider } from './services/AnalyticsDataProvider';
import { getUserMetricsAnalyzer } from './getUserMetricsAnalyzer';
import { getEventActivityAnalyzer } from './getEventActivityAnalyzer';

let instance: AnalyticsDataProvider | null = null;

export function getAnalyticsDataProvider(): AnalyticsDataProvider {
	if (!browser) throw new Error('getAnalyticsDataProvider() is browser-only');
	return instance ??= new AnalyticsDataProvider(
		getUserMetricsAnalyzer(),
		getEventActivityAnalyzer(),
	);
}
