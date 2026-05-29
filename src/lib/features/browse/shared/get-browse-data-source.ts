import { browser } from '$app/environment';

import { BrowseDataSource } from './services/browse-data-source';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';
import { soloPropRepository } from '$lib/shared/foundation/services/solo-prop-repository-store';
import { handPathRepository } from '$lib/shared/foundation/services/hand-path-repository-store';

let instance: BrowseDataSource | null = null;

export function getBrowseDataSource(): BrowseDataSource {
	if (!browser) throw new Error('getBrowseDataSource() is browser-only');
	return instance ??= new BrowseDataSource(getBrowseLoader(), soloPropRepository, handPathRepository);
}
