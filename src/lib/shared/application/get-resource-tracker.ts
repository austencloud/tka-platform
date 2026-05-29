import { browser } from '$app/environment';
import { ResourceTracker } from './services/resource-tracker';

let instance: ResourceTracker | null = null;

export function getResourceTracker(): ResourceTracker {
	if (!browser) throw new Error('getResourceTracker() is browser-only');
	return instance ??= new ResourceTracker();
}
