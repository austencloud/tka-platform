import { browser } from '$app/environment';
import { ShortcutCustomizer } from './services/implementations/ShortcutCustomizer';
import { getShortcutRegistry } from './getShortcutRegistry';

let instance: ShortcutCustomizer | null = null;

export function getShortcutCustomizer(): ShortcutCustomizer {
	if (!browser) throw new Error('getShortcutCustomizer() is browser-only');
	return instance ??= new ShortcutCustomizer(getShortcutRegistry());
}
