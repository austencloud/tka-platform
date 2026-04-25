import { browser } from '$app/environment';
import type { IPersistenceService } from './services/contracts/IPersistenceService';
import { DexiePersistenceService } from './services/implementations/DexiePersistenceService';

let instance: IPersistenceService | null = null;

export function getPersistenceService(): IPersistenceService {
	if (!browser) throw new Error('getPersistenceService() is browser-only');
	return instance ??= new DexiePersistenceService();
}
