import { browser } from '$app/environment';
import { PersistenceInitializationService } from './services/persistence-initialization-service';

let instance: PersistenceInitializationService | null = null;

export function getPersistenceInitializationService(): PersistenceInitializationService {
	if (!browser) throw new Error('getPersistenceInitializationService() is browser-only');
	return instance ??= new PersistenceInitializationService();
}
