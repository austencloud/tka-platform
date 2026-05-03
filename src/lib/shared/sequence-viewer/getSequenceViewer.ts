import { browser } from '$app/environment';
import { SequenceViewer } from './services/implementations/SequenceViewer';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';
import { getSequenceEncoder } from '$lib/shared/navigation/getSequenceEncoder';

let instance: SequenceViewer | null = null;

export function getSequenceViewer(): SequenceViewer {
	if (!browser) throw new Error('getSequenceViewer() is browser-only');
	return instance ??= new SequenceViewer(getPersistenceService(), getSequenceEncoder());
}
