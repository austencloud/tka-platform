import { browser } from '$app/environment';
import type { INavigator } from './services/contracts/INavigator';
import { Navigator } from './services/implementations/Navigator';

let instance: INavigator | null = null;

export function getBrowseNavigator(): INavigator {
	if (!browser) throw new Error('getBrowseNavigator() is browser-only');
	return instance ??= new Navigator();
}
