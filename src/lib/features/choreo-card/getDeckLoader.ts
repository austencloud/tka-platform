import { browser } from '$app/environment';
import type { IDeckLoader } from './services/contracts/IDeckLoader';
import { DeckLoader } from './services/implementations/DeckLoader';

let instance: IDeckLoader | null = null;

export function getDeckLoader(): IDeckLoader {
	if (!browser) throw new Error('getDeckLoader() is browser-only');
	return instance ??= new DeckLoader();
}
