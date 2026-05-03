import { browser } from '$app/environment';
import { DeckLoader } from './services/implementations/DeckLoader';

let instance: DeckLoader | null = null;

export function getDeckLoader(): DeckLoader {
	if (!browser) throw new Error('getDeckLoader() is browser-only');
	return instance ??= new DeckLoader();
}
