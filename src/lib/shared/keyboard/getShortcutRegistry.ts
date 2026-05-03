import { browser } from '$app/environment';
import { ShortcutRegistry } from './services/implementations/ShortcutRegistry';

let instance: ShortcutRegistry | null = null;

export function getShortcutRegistry(): ShortcutRegistry {
	if (!browser) throw new Error('getShortcutRegistry() is browser-only');
	return instance ??= new ShortcutRegistry();
}
