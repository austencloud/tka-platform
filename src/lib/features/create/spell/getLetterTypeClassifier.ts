import { browser } from '$app/environment';
import { LetterTypeClassifier } from './services/implementations/LetterTypeClassifier';

let instance: LetterTypeClassifier | null = null;

export function getLetterTypeClassifier(): LetterTypeClassifier {
	if (!browser) throw new Error('getLetterTypeClassifier() is browser-only');
	return instance ??= new LetterTypeClassifier();
}
