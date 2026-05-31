import { browser } from '$app/environment';
import { SequenceRepository } from './services/SequenceRepository';
import { getSequenceDomainManager } from '$lib/shared/create/getSequenceDomainManager';
import { getReversalDetector } from '$lib/shared/create/getReversalDetector';
import { sequenceImporter } from '$lib/shared/create/services/SequenceImporter';

let instance: SequenceRepository | null = null;

export function getSequenceRepository(): SequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getReversalDetector(),
		sequenceImporter,
	);
}
