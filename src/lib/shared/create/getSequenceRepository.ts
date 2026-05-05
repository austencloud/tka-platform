import { browser } from '$app/environment';
import { SequenceRepository } from './services/SequenceRepository';
import { getSequenceDomainManager } from '$lib/shared/create/getSequenceDomainManager';
import { getReversalDetector } from '$lib/shared/create/getReversalDetector';
import { getSequenceImporter } from '$lib/shared/create/getSequenceImporter';

let instance: SequenceRepository | null = null;

export function getSequenceRepository(): SequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getReversalDetector(),
		getSequenceImporter(),
	);
}
