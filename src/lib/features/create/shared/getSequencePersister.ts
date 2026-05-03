import { browser } from '$app/environment';
import { SequencePersister } from './services/implementations/SequencePersister';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';

let instance: SequencePersister | null = null;

export function getSequencePersister(): SequencePersister {
	if (!browser) throw new Error('getSequencePersister() is browser-only');
	return instance ??= new SequencePersister(getPersistenceService());
}
