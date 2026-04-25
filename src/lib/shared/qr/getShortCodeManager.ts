import { browser } from '$app/environment';
import type { IShortCodeManager } from './services/contracts/IShortCodeManager';
import type { IBrowseLoader } from '$lib/features/browse/sequences/display/services/contracts/IBrowseLoader';
import { ShortCodeManager } from './services/implementations/ShortCodeManager';
import { getSequenceEncoder } from '$lib/shared/navigation/getSequenceEncoder';
import { getPublicSequenceHashMatcher } from '$lib/shared/sequence-viewer/getPublicSequenceHashMatcher';

let instance: IShortCodeManager | null = null;
let _browseLoader: IBrowseLoader | null = null;

/**
 * Must be called once from di/index.ts after the browse container is built,
 * before any consumer calls getShortCodeManager().
 */
export function configureShortCodeManager(browseLoader: IBrowseLoader): void {
	_browseLoader = browseLoader;
}

export function getShortCodeManager(): IShortCodeManager {
	if (!browser) throw new Error('getShortCodeManager() is browser-only');
	if (!instance) {
		if (!_browseLoader) {
			throw new Error('getShortCodeManager(): call configureShortCodeManager() first');
		}
		instance = new ShortCodeManager(
			_browseLoader,
			getSequenceEncoder(),
			getPublicSequenceHashMatcher(),
		);
	}
	return instance;
}
