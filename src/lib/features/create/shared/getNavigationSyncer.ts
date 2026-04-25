import { browser } from '$app/environment';
import type { INavigationSyncer } from './services/contracts/INavigationSyncer';
import { NavigationSyncer } from './services/implementations/NavigationSyncer';

let instance: INavigationSyncer | null = null;

export function getNavigationSyncer(): INavigationSyncer {
	if (!browser) throw new Error('getNavigationSyncer() is browser-only');
	return instance ??= new NavigationSyncer();
}
