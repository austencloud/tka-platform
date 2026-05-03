import { browser } from '$app/environment';
import { ResourceTracker } from './services/implementations/ResourceTracker';

let instance: ResourceTracker | null = null;

export function getResourceTracker(): ResourceTracker {
	if (!browser) throw new Error('getResourceTracker() is browser-only');
	return instance ??= new ResourceTracker();
}
