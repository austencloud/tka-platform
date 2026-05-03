import { browser } from '$app/environment';
import { LetterToConceptMapper } from './services/implementations/LetterToConceptMapper';

let instance: LetterToConceptMapper | null = null;

export function getLetterToConceptMapper(): LetterToConceptMapper {
	if (!browser) throw new Error('getLetterToConceptMapper() is browser-only');
	return instance ??= new LetterToConceptMapper();
}
