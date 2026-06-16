import { browser } from '$app/environment';
import { PersistenceInitializer } from './services/persistence-initializer';

let instance: PersistenceInitializer | null = null;

export function getPersistenceInitializer(): PersistenceInitializer {
	if (!browser) throw new Error('getPersistenceInitializer() is browser-only');
	return instance ??= new PersistenceInitializer();
}
