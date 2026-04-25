import { browser } from '$app/environment';
import { DeepOceanBackgroundOrchestrator } from '@austencloud/backgrounds';

let instance: DeepOceanBackgroundOrchestrator | null = null;

export function getDeepOceanBackgroundSystem(): DeepOceanBackgroundOrchestrator {
	if (!browser) throw new Error('getDeepOceanBackgroundSystem() is browser-only');
	return instance ??= DeepOceanBackgroundOrchestrator.create();
}
