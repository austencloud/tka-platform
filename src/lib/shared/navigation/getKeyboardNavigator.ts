import { browser } from '$app/environment';

import { KeyboardNavigator } from './services/KeyboardNavigator';

let instance: KeyboardNavigator | null = null;

export function getKeyboardNavigator(): KeyboardNavigator {
	if (!browser) throw new Error('getKeyboardNavigator() is browser-only');
	return instance ??= new KeyboardNavigator();
}
