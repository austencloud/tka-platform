import { browser } from '$app/environment';
import type { ISequenceTransferHandler } from './services/contracts/ISequenceTransferHandler';
import { SequenceTransferHandler } from './services/implementations/SequenceTransferHandler';

let instance: ISequenceTransferHandler | null = null;

export function getSequenceTransferHandler(): ISequenceTransferHandler {
	if (!browser) throw new Error('getSequenceTransferHandler() is browser-only');
	return instance ??= new SequenceTransferHandler();
}
