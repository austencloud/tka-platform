import { browser } from '$app/environment';
import type { IOptionTransitionCoordinator } from './services/contracts/IOptionTransitionCoordinator';
import { OptionTransitionCoordinator } from './services/implementations/OptionTransitionCoordinator';

let instance: IOptionTransitionCoordinator | null = null;

export function getOptionTransitionCoordinator(): IOptionTransitionCoordinator {
	if (!browser) throw new Error('getOptionTransitionCoordinator() is browser-only');
	return instance ??= new OptionTransitionCoordinator();
}
