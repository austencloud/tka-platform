import { browser } from '$app/environment';

import { BrowseEventHandler } from './services/implementations/BrowseEventHandler';
import { getBrowseLoader } from '../sequences/display/getBrowseLoader';

let instance: BrowseEventHandler | null = null;

export function getBrowseEventHandler(): BrowseEventHandler {
	if (!browser) throw new Error('getBrowseEventHandler() is browser-only');
	return instance ??= new BrowseEventHandler(getBrowseLoader());
}
