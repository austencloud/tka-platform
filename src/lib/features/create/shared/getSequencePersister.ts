import { browser } from '$app/environment';
import type { ISequencePersister } from './services/contracts/ISequencePersister';
import { SequencePersister } from './services/implementations/SequencePersister';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';

let instance: ISequencePersister | null = null;

export function getSequencePersister(): ISequencePersister {
	if (!browser) throw new Error('getSequencePersister() is browser-only');
	return instance ??= new SequencePersister(getPersistenceService());
}
