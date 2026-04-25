import { browser } from '$app/environment';
import type { IShortcutRegistry } from './services/contracts/IShortcutRegistry';
import { ShortcutRegistry } from './services/implementations/ShortcutRegistry';

let instance: IShortcutRegistry | null = null;

export function getShortcutRegistry(): IShortcutRegistry {
	if (!browser) throw new Error('getShortcutRegistry() is browser-only');
	return instance ??= new ShortcutRegistry();
}
