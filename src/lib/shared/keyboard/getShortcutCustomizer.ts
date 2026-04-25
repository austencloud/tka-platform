import { browser } from '$app/environment';
import type { IShortcutCustomizer } from './services/contracts/IShortcutCustomizer';
import { ShortcutCustomizer } from './services/implementations/ShortcutCustomizer';
import { getShortcutRegistry } from './getShortcutRegistry';

let instance: IShortcutCustomizer | null = null;

export function getShortcutCustomizer(): IShortcutCustomizer {
	if (!browser) throw new Error('getShortcutCustomizer() is browser-only');
	return instance ??= new ShortcutCustomizer(getShortcutRegistry());
}
