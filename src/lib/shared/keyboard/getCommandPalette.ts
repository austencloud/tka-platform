import { browser } from '$app/environment';

import { CommandPalette } from './services/implementations/CommandPalette';

let instance: CommandPalette | null = null;

export function getCommandPalette(): CommandPalette {
	if (!browser) throw new Error('getCommandPalette() is browser-only');
	return instance ??= new CommandPalette();
}
