import { browser } from '$app/environment';

import { OptionTransitionCoordinator } from './services/implementations/OptionTransitionCoordinator';

let instance: OptionTransitionCoordinator | null = null;

export function getOptionTransitionCoordinator(): OptionTransitionCoordinator {
	if (!browser) throw new Error('getOptionTransitionCoordinator() is browser-only');
	return instance ??= new OptionTransitionCoordinator();
}
