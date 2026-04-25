import { browser } from '$app/environment';
import type { INavigator } from './services/contracts/INavigator';
import { Navigator } from './services/implementations/Navigator';

let instance: INavigator | null = null;

export function getLoopLabelerNavigator(): INavigator {
	if (!browser) throw new Error('getLoopLabelerNavigator() is browser-only');
	return instance ??= new Navigator();
}
