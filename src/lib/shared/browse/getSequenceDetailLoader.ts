import { browser } from '$app/environment';
import { SequenceDetailLoader } from '$lib/features/browse/sequences/display/services/implementations/SequenceDetailLoader';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: SequenceDetailLoader | null = null;

export function getSequenceDetailLoader(): SequenceDetailLoader {
	if (!browser) throw new Error('getSequenceDetailLoader() is browser-only');
	return instance ??= new SequenceDetailLoader(getBrowseLoader());
}
