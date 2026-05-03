import { browser } from '$app/environment';
import { NavigationValidator } from './services/implementations/NavigationValidator';

let instance: NavigationValidator | null = null;

export function getNavigationValidator(): NavigationValidator {
	if (!browser) throw new Error('getNavigationValidator() is browser-only');
	return instance ??= new NavigationValidator();
}
