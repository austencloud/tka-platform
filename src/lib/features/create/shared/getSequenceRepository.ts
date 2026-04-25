import { browser } from '$app/environment';
import type { ISequenceRepository } from './services/contracts/ISequenceRepository';
import { SequenceRepository } from './services/implementations/SequenceRepository';
import { getSequenceDomainManager } from './getSequenceDomainManager';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';
import { getReversalDetector } from './getReversalDetector';
import { getSequenceNormalizer } from '$lib/features/compose/getSequenceNormalizer';
import { getSequenceImporter } from './getSequenceImporter';

let instance: ISequenceRepository | null = null;

export function getSequenceRepository(): ISequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getPersistenceService() as any,
		getReversalDetector(),
		getSequenceNormalizer(),
		getSequenceImporter(),
	);
}
