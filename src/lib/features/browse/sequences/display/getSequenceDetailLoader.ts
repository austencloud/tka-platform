import { browser } from '$app/environment';
import type { ISequenceDetailLoader } from './services/contracts/ISequenceDetailLoader';
import { SequenceDetailLoader } from './services/implementations/SequenceDetailLoader';
import { getBrowseLoader } from './getBrowseLoader';

let instance: ISequenceDetailLoader | null = null;

export function getSequenceDetailLoader(): ISequenceDetailLoader {
	if (!browser) throw new Error('getSequenceDetailLoader() is browser-only');
	return instance ??= new SequenceDetailLoader(getBrowseLoader());
}
