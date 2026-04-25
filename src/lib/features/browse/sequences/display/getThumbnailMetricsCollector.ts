import { browser } from '$app/environment';
import type { IThumbnailMetricsCollector } from './services/contracts/IThumbnailMetricsCollector';
import { ThumbnailMetricsCollector } from './services/implementations/ThumbnailMetricsCollector';

let instance: IThumbnailMetricsCollector | null = null;

export function getThumbnailMetricsCollector(): IThumbnailMetricsCollector {
	if (!browser) throw new Error('getThumbnailMetricsCollector() is browser-only');
	if (!instance) {
		instance = new ThumbnailMetricsCollector();
		if (import.meta.env.DEV) {
			instance.startLogging();
		}
	}
	return instance;
}
