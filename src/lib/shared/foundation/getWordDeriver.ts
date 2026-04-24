import type { IWordDeriver } from './services/contracts/IWordDeriver';
import { WordDeriver } from './services/implementations/WordDeriver';

let instance: IWordDeriver | null = null;

/** WordDeriver is SSR-safe (no DOM deps) — no browser guard needed. */
export function getWordDeriver(): IWordDeriver {
	return instance ??= new WordDeriver();
}
