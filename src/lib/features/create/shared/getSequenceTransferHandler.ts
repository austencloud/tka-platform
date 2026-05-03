import { browser } from '$app/environment';

import { SequenceTransferHandler } from './services/implementations/SequenceTransferHandler';

let instance: SequenceTransferHandler | null = null;

export function getSequenceTransferHandler(): SequenceTransferHandler {
	if (!browser) throw new Error('getSequenceTransferHandler() is browser-only');
	return instance ??= new SequenceTransferHandler();
}
