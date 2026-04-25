import { browser } from '$app/environment';
import type { IKeyboardShortcutManager } from './services/contracts/IKeyboardShortcutManager';
import { KeyboardShortcutManager } from './services/implementations/KeyboardShortcutManager';
import { getShortcutRegistry } from './getShortcutRegistry';

let instance: IKeyboardShortcutManager | null = null;

export function getKeyboardShortcutManager(): IKeyboardShortcutManager {
	if (!browser) throw new Error('getKeyboardShortcutManager() is browser-only');
	return instance ??= new KeyboardShortcutManager(getShortcutRegistry());
}
