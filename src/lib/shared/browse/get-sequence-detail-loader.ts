import { browser } from '$app/environment';
import { SequenceDetailLoader } from '$lib/shared/browse/services/sequence-detail-loader';
import { getBrowseLoader } from '$lib/shared/browse/get-browse-loader';

let instance: SequenceDetailLoader | null = null;

export function getSequenceDetailLoader(): SequenceDetailLoader {
	if (!browser) throw new Error('getSequenceDetailLoader() is browser-only');
	return instance ??= new SequenceDetailLoader(getBrowseLoader());
}
