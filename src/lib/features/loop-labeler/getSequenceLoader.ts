import { browser } from '$app/environment';
import type { ISequenceLoader } from './services/contracts/ISequenceLoader';
import { SequenceLoader } from './services/implementations/SequenceLoader';

let instance: ISequenceLoader | null = null;

export function getSequenceLoader(): ISequenceLoader {
	if (!browser) throw new Error('getSequenceLoader() is browser-only');
	return instance ??= new SequenceLoader();
}
