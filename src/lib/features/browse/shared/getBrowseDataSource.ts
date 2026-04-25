import { browser } from '$app/environment';
import type { IBrowseDataSource } from './services/contracts/IBrowseDataSource';
import { BrowseDataSource } from './services/implementations/BrowseDataSource';
import { getBrowseLoader } from '../sequences/display/getBrowseLoader';
import { soloPropRepository } from '$lib/shared/foundation/services/implementations/SoloPropRepository';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';

let instance: IBrowseDataSource | null = null;

export function getBrowseDataSource(): IBrowseDataSource {
	if (!browser) throw new Error('getBrowseDataSource() is browser-only');
	return instance ??= new BrowseDataSource(getBrowseLoader(), soloPropRepository, handPathRepository);
}
