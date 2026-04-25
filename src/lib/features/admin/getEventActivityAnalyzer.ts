import { browser } from '$app/environment';
import type { IEventActivityAnalyzer } from './services/implementations/EventActivityAnalyzer';
import { EventActivityAnalyzer } from './services/implementations/EventActivityAnalyzer';
import { getActivityLogger } from '$lib/shared/analytics/getActivityLogger';

let instance: IEventActivityAnalyzer | null = null;

export function getEventActivityAnalyzer(): IEventActivityAnalyzer {
	if (!browser) throw new Error('getEventActivityAnalyzer() is browser-only');
	return instance ??= new EventActivityAnalyzer(getActivityLogger());
}
