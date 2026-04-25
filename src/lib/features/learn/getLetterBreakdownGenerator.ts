import { browser } from '$app/environment';
import type { ILetterBreakdownGenerator } from './services/contracts/ILetterBreakdownGenerator';
import { LetterBreakdownGenerator } from './services/implementations/LetterBreakdownGenerator';

let instance: ILetterBreakdownGenerator | null = null;

export function getLetterBreakdownGenerator(): ILetterBreakdownGenerator {
	if (!browser) throw new Error('getLetterBreakdownGenerator() is browser-only');
	return instance ??= new LetterBreakdownGenerator();
}
