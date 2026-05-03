import { browser } from '$app/environment';
import { Navigator } from './services/implementations/Navigator';

let instance: Navigator | null = null;

export function getLoopLabelerNavigator(): Navigator {
	if (!browser) throw new Error('getLoopLabelerNavigator() is browser-only');
	return instance ??= new Navigator();
}
