import { browser } from '$app/environment';
import { sequenceMetadataManager } from './services/sequence-metadata-manager';

export function getSequenceMetadataManager(): typeof sequenceMetadataManager {
	if (!browser) throw new Error('getSequenceMetadataManager() is browser-only');
	return sequenceMetadataManager;
}
