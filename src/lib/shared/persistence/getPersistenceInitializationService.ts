import { browser } from '$app/environment';
import type { IPersistenceInitializationService } from './services/contracts/IPersistenceInitializationService';
import { PersistenceInitializationService } from './services/implementations/PersistenceInitializationService';
import { getPersistenceService } from './getPersistenceService';

let instance: IPersistenceInitializationService | null = null;

export function getPersistenceInitializationService(): IPersistenceInitializationService {
	if (!browser) throw new Error('getPersistenceInitializationService() is browser-only');
	return instance ??= new PersistenceInitializationService(getPersistenceService());
}
