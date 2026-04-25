import { browser } from '$app/environment';
import type { IUserKnowledgeProfilePersister } from './services/contracts/IUserKnowledgeProfilePersister';
import { UserKnowledgeProfilePersister } from './services/implementations/UserKnowledgeProfilePersister';

let instance: IUserKnowledgeProfilePersister | null = null;

export function getUserKnowledgeProfilePersister(): IUserKnowledgeProfilePersister {
	if (!browser) throw new Error('getUserKnowledgeProfilePersister() is browser-only');
	return instance ??= new UserKnowledgeProfilePersister();
}
