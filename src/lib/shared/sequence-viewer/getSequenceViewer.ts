import { browser } from '$app/environment';
import type { ISequenceViewer } from './services/contracts/ISequenceViewer';
import { SequenceViewer } from './services/implementations/SequenceViewer';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';
import { getSequenceEncoder } from '$lib/shared/navigation/getSequenceEncoder';

let instance: ISequenceViewer | null = null;

export function getSequenceViewer(): ISequenceViewer {
	if (!browser) throw new Error('getSequenceViewer() is browser-only');
	return instance ??= new SequenceViewer(getPersistenceService(), getSequenceEncoder());
}
