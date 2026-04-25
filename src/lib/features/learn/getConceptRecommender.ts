import { browser } from '$app/environment';
import type { IConceptRecommender } from './services/contracts/IConceptRecommender';
import { ConceptRecommender } from './services/implementations/ConceptRecommender';

let instance: IConceptRecommender | null = null;

export function getConceptRecommender(): IConceptRecommender {
	if (!browser) throw new Error('getConceptRecommender() is browser-only');
	return instance ??= new ConceptRecommender();
}
