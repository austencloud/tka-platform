import { browser } from '$app/environment';
import { ConceptRecommender } from './services/implementations/ConceptRecommender';

let instance: ConceptRecommender | null = null;

export function getConceptRecommender(): ConceptRecommender {
	if (!browser) throw new Error('getConceptRecommender() is browser-only');
	return instance ??= new ConceptRecommender();
}
