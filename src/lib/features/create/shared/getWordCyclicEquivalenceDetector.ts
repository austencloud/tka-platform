import { browser } from '$app/environment';

import { WordCyclicEquivalenceDetector } from './services/implementations/WordCyclicEquivalenceDetector';

let instance: WordCyclicEquivalenceDetector | null = null;

export function getWordCyclicEquivalenceDetector(): WordCyclicEquivalenceDetector {
	if (!browser) throw new Error('getWordCyclicEquivalenceDetector() is browser-only');
	return instance ??= new WordCyclicEquivalenceDetector();
}
