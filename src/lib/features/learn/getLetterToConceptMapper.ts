import { browser } from '$app/environment';
import type { ILetterToConceptMapper } from './services/contracts/ILetterToConceptMapper';
import { LetterToConceptMapper } from './services/implementations/LetterToConceptMapper';

let instance: ILetterToConceptMapper | null = null;

export function getLetterToConceptMapper(): ILetterToConceptMapper {
	if (!browser) throw new Error('getLetterToConceptMapper() is browser-only');
	return instance ??= new LetterToConceptMapper();
}
