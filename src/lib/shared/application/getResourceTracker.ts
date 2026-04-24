import { browser } from '$app/environment';
import type { IResourceTracker } from './services/contracts/IResourceTracker';
import { ResourceTracker } from './services/implementations/ResourceTracker';

let instance: IResourceTracker | null = null;

export function getResourceTracker(): IResourceTracker {
	if (!browser) throw new Error('getResourceTracker() is browser-only');
	return instance ??= new ResourceTracker();
}
