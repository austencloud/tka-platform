import { browser } from '$app/environment';
import type { ISequenceIndexer } from './services/contracts/ISequenceIndexer';
import { SequenceIndexer } from './services/implementations/SequenceIndexer';

let instance: ISequenceIndexer | null = null;

export function getSequenceIndexer(): ISequenceIndexer {
	if (!browser) throw new Error('getSequenceIndexer() is browser-only');
	return instance ??= new SequenceIndexer();
}
