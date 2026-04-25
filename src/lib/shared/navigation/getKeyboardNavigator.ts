import { browser } from '$app/environment';
import type { IKeyboardNavigator } from './services/contracts/IKeyboardNavigator';
import { KeyboardNavigator } from './services/KeyboardNavigator';

let instance: IKeyboardNavigator | null = null;

export function getKeyboardNavigator(): IKeyboardNavigator {
	if (!browser) throw new Error('getKeyboardNavigator() is browser-only');
	return instance ??= new KeyboardNavigator();
}
