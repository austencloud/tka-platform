import { browser } from '$app/environment';
import { OptionOrganizer } from './services/implementations/OptionOrganizer';

let instance: OptionOrganizer | null = null;

export function getOptionOrganizer(): OptionOrganizer {
	if (!browser) throw new Error('getOptionOrganizer() is browser-only');
	return instance ??= new OptionOrganizer();
}
