import { browser } from '$app/environment';
import { SequenceDetailLoader } from './services/implementations/SequenceDetailLoader';
import { getBrowseLoader } from './getBrowseLoader';

let instance: SequenceDetailLoader | null = null;

export function getSequenceDetailLoader(): SequenceDetailLoader {
	if (!browser) throw new Error('getSequenceDetailLoader() is browser-only');
	return instance ??= new SequenceDetailLoader(getBrowseLoader());
}
