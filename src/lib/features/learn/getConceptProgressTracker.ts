import { browser } from '$app/environment';
import type { IConceptProgressTracker } from './services/contracts/IConceptProgressTracker';
import { ConceptProgressTracker } from './services/implementations/ConceptProgressTracker';
import { getUserKnowledgeProfilePersister } from './getUserKnowledgeProfilePersister';

let instance: IConceptProgressTracker | null = null;

export function getConceptProgressTracker(): IConceptProgressTracker {
	if (!browser) throw new Error('getConceptProgressTracker() is browser-only');
	return instance ??= new ConceptProgressTracker(getUserKnowledgeProfilePersister());
}
