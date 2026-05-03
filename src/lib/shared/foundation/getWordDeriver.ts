
import { WordDeriver } from './services/implementations/WordDeriver';

let instance: WordDeriver | null = null;

/** WordDeriver is SSR-safe (no DOM deps) - no browser guard needed. */
export function getWordDeriver(): WordDeriver {
	return instance ??= new WordDeriver();
}
