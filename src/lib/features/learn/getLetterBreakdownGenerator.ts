import { browser } from '$app/environment';

import { LetterBreakdownGenerator } from './services/implementations/LetterBreakdownGenerator';

let instance: LetterBreakdownGenerator | null = null;

export function getLetterBreakdownGenerator(): LetterBreakdownGenerator {
	if (!browser) throw new Error('getLetterBreakdownGenerator() is browser-only');
	return instance ??= new LetterBreakdownGenerator();
}
