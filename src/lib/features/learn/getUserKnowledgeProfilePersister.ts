import { browser } from '$app/environment';

import { UserKnowledgeProfilePersister } from './services/implementations/UserKnowledgeProfilePersister';

let instance: UserKnowledgeProfilePersister | null = null;

export function getUserKnowledgeProfilePersister(): UserKnowledgeProfilePersister {
	if (!browser) throw new Error('getUserKnowledgeProfilePersister() is browser-only');
	return instance ??= new UserKnowledgeProfilePersister();
}
