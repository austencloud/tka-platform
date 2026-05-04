import { browser } from '$app/environment';
import { SequenceRepository } from './services/implementations/SequenceRepository';
import { getSequenceDomainManager } from './getSequenceDomainManager';
import { getReversalDetector } from './getReversalDetector';
import { getSequenceImporter } from './getSequenceImporter';

let instance: SequenceRepository | null = null;

export function getSequenceRepository(): SequenceRepository {
	if (!browser) throw new Error('getSequenceRepository() is browser-only');
	return instance ??= new SequenceRepository(
		getSequenceDomainManager(),
		getReversalDetector(),
		getSequenceImporter(),
	);
}
