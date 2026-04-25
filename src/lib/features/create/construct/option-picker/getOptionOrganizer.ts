import { browser } from '$app/environment';
import type { IOptionOrganizer } from './services/contracts/IOptionOrganizer';
import { OptionOrganizer } from './services/implementations/OptionOrganizer';

let instance: IOptionOrganizer | null = null;

export function getOptionOrganizer(): IOptionOrganizer {
	if (!browser) throw new Error('getOptionOrganizer() is browser-only');
	return instance ??= new OptionOrganizer();
}
