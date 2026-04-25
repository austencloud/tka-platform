import { browser } from '$app/environment';
import type { ISpellServiceLoader } from './services/contracts/ISpellServiceLoader';
import { SpellServiceLoader } from './services/implementations/SpellServiceLoader';

let instance: ISpellServiceLoader | null = null;

export function getSpellServiceLoader(): ISpellServiceLoader {
	if (!browser) throw new Error('getSpellServiceLoader() is browser-only');
	return instance ??= new SpellServiceLoader();
}
