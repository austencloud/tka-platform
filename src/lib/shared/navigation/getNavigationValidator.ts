import { browser } from '$app/environment';
import type { INavigationValidator } from './services/contracts/INavigationValidator';
import { NavigationValidator } from './services/implementations/NavigationValidator';

let instance: INavigationValidator | null = null;

export function getNavigationValidator(): INavigationValidator {
	if (!browser) throw new Error('getNavigationValidator() is browser-only');
	return instance ??= new NavigationValidator();
}
