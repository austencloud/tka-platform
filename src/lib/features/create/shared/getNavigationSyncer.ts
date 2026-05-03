import { browser } from '$app/environment';

import { NavigationSyncer } from './services/implementations/NavigationSyncer';

let instance: NavigationSyncer | null = null;

export function getNavigationSyncer(): NavigationSyncer {
	if (!browser) throw new Error('getNavigationSyncer() is browser-only');
	return instance ??= new NavigationSyncer();
}
