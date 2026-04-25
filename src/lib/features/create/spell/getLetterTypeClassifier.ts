import { browser } from '$app/environment';
import type { ILetterTypeClassifier } from './services/contracts/ILetterTypeClassifier';
import { LetterTypeClassifier } from './services/implementations/LetterTypeClassifier';

let instance: ILetterTypeClassifier | null = null;

export function getLetterTypeClassifier(): ILetterTypeClassifier {
	if (!browser) throw new Error('getLetterTypeClassifier() is browser-only');
	return instance ??= new LetterTypeClassifier();
}
