import { browser } from '$app/environment';
import { ConceptProgressTracker } from './services/implementations/ConceptProgressTracker';
import { getUserKnowledgeProfilePersister } from './getUserKnowledgeProfilePersister';

let instance: ConceptProgressTracker | null = null;

export function getConceptProgressTracker(): ConceptProgressTracker {
	if (!browser) throw new Error('getConceptProgressTracker() is browser-only');
	return instance ??= new ConceptProgressTracker(getUserKnowledgeProfilePersister());
}
