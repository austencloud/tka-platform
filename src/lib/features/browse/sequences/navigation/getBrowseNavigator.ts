import { browser } from '$app/environment';
import { Navigator } from './services/implementations/Navigator';

let instance: Navigator | null = null;

export function getBrowseNavigator(): Navigator {
	if (!browser) throw new Error('getBrowseNavigator() is browser-only');
	return instance ??= new Navigator();
}
