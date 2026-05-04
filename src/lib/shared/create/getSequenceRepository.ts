import { browser } from '$app/environment';
import { SequenceRepository } from './services/SequenceRepository';
import { getSequenceDomainManager } from '$lib/features/create/shared/getSequenceDomainManager';
import { getReversalDetector } from '$lib/features/create/shared/getReversalDetector';
import { getSequenceImporter } from '$lib/features/create/shared/getSequenceImporter';

let instance: SequenceRepository | null = null;

export function getSequenceRepository(): SequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getReversalDetector(),
		getSequenceImporter(),
	);
}
