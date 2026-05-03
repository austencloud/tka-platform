import { browser } from '$app/environment';

import { KeyboardShortcutManager } from './services/implementations/KeyboardShortcutManager';
import { getShortcutRegistry } from './getShortcutRegistry';

let instance: KeyboardShortcutManager | null = null;

export function getKeyboardShortcutManager(): KeyboardShortcutManager {
	if (!browser) throw new Error('getKeyboardShortcutManager() is browser-only');
	return instance ??= new KeyboardShortcutManager(getShortcutRegistry());
}
