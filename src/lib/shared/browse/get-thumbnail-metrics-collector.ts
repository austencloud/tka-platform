import { browser } from '$app/environment';
import { ThumbnailMetricsCollector } from './services/thumbnail-metrics-collector';

let instance: ThumbnailMetricsCollector | null = null;

export function getThumbnailMetricsCollector(): ThumbnailMetricsCollector {
	if (!browser) throw new Error('getThumbnailMetricsCollector() is browser-only');
	if (!instance) {
		instance = new ThumbnailMetricsCollector();
		if (import.meta.env.DEV) {
			instance.startLogging();
		}
	}
	return instance;
}
