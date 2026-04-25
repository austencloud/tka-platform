import { browser } from '$app/environment';
import type { IWordCyclicEquivalenceDetector } from './services/contracts/IWordCyclicEquivalenceDetector';
import { WordCyclicEquivalenceDetector } from './services/implementations/WordCyclicEquivalenceDetector';

let instance: IWordCyclicEquivalenceDetector | null = null;

export function getWordCyclicEquivalenceDetector(): IWordCyclicEquivalenceDetector {
	if (!browser) throw new Error('getWordCyclicEquivalenceDetector() is browser-only');
	return instance ??= new WordCyclicEquivalenceDetector();
}
