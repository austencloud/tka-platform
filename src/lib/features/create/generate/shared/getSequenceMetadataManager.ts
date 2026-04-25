import { browser } from '$app/environment';
import type { ISequenceMetadataManager } from './services/contracts/ISequenceMetadataManager';
import { SequenceMetadataManager } from './services/implementations/SequenceMetadataManager';

let instance: ISequenceMetadataManager | null = null;

export function getSequenceMetadataManager(): ISequenceMetadataManager {
	if (!browser) throw new Error('getSequenceMetadataManager() is browser-only');
	return instance ??= new SequenceMetadataManager();
}
