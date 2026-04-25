import { browser } from '$app/environment';
import type { ICommandPalette } from './services/contracts/ICommandPalette';
import { CommandPalette } from './services/implementations/CommandPalette';

let instance: ICommandPalette | null = null;

export function getCommandPalette(): ICommandPalette {
	if (!browser) throw new Error('getCommandPalette() is browser-only');
	return instance ??= new CommandPalette();
}
