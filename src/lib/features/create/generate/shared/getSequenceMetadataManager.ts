import { browser } from '$app/environment';
import { SequenceMetadataManager } from './services/implementations/SequenceMetadataManager';

let instance: SequenceMetadataManager | null = null;

export function getSequenceMetadataManager(): SequenceMetadataManager {
	if (!browser) throw new Error('getSequenceMetadataManager() is browser-only');
	return instance ??= new SequenceMetadataManager();
}
