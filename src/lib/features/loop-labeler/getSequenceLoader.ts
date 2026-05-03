import { browser } from '$app/environment';
import { SequenceLoader } from './services/implementations/SequenceLoader';

let instance: SequenceLoader | null = null;

export function getSequenceLoader(): SequenceLoader {
	if (!browser) throw new Error('getSequenceLoader() is browser-only');
	return instance ??= new SequenceLoader();
}
