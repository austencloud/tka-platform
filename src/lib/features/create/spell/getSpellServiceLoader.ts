import { browser } from '$app/environment';
import { SpellServiceLoader } from './services/implementations/SpellServiceLoader';

let instance: SpellServiceLoader | null = null;

export function getSpellServiceLoader(): SpellServiceLoader {
	if (!browser) throw new Error('getSpellServiceLoader() is browser-only');
	return instance ??= new SpellServiceLoader();
}
