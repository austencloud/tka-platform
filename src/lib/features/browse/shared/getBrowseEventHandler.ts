import { browser } from '$app/environment';
import type { IBrowseEventHandler } from './services/contracts/IBrowseEventHandler';
import { BrowseEventHandler } from './services/implementations/BrowseEventHandler';
import { getSheetRouter } from '$lib/shared/navigation/getSheetRouter';
import { getBrowseLoader } from '../sequences/display/getBrowseLoader';

let instance: IBrowseEventHandler | null = null;

export function getBrowseEventHandler(): IBrowseEventHandler {
	if (!browser) throw new Error('getBrowseEventHandler() is browser-only');
	return instance ??= new BrowseEventHandler(getSheetRouter(), getBrowseLoader());
}
