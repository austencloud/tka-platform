import { browser } from '$app/environment';
import { SequenceRepository } from './services/sequence-repository';
import { getSequenceDomainManager } from '$lib/shared/create/get-sequence-domain-manager';
import { getReversalDetector } from '$lib/shared/create/get-reversal-detector';
import { sequenceImporter } from '$lib/shared/create/services/sequence-importer';

let instance: SequenceRepository | null = null;

export function getSequenceRepository(): SequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getReversalDetector(),
		sequenceImporter,
	);
}
