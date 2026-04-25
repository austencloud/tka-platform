import { browser } from '$app/environment';
import type { IDeepLinker } from './services/contracts/IDeepLinker';
import { DeepLinker } from './services/implementations/DeepLinker';
import { getSequenceEncoder } from './getSequenceEncoder';

let instance: IDeepLinker | null = null;

export function getDeepLinker(): IDeepLinker {
	if (!browser) throw new Error('getDeepLinker() is browser-only');
	return instance ??= new DeepLinker(getSequenceEncoder());
}
