import { browser } from '$app/environment';
import { DeepLinker } from './services/implementations/DeepLinker';
import { getSequenceEncoder } from './getSequenceEncoder';

let instance: DeepLinker | null = null;

export function getDeepLinker(): DeepLinker {
	if (!browser) throw new Error('getDeepLinker() is browser-only');
	return instance ??= new DeepLinker(getSequenceEncoder());
}
