import { browser } from '$app/environment';
import { SequenceIndexer } from './services/implementations/SequenceIndexer';

let instance: SequenceIndexer | null = null;

export function getSequenceIndexer(): SequenceIndexer {
	if (!browser) throw new Error('getSequenceIndexer() is browser-only');
	return instance ??= new SequenceIndexer();
}
