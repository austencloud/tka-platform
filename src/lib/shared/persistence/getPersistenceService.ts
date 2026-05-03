import { browser } from '$app/environment';
import { DexiePersistenceService } from './services/implementations/DexiePersistenceService';

let instance: DexiePersistenceService | null = null;

export function getPersistenceService(): DexiePersistenceService {
	if (!browser) throw new Error('getPersistenceService() is browser-only');
	return instance ??= new DexiePersistenceService();
}
