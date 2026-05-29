import { browser } from '$app/environment';
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import { ShortCodeManager } from './services/short-code-manager';
import { getPublicSequenceHashMatcher } from '$lib/shared/sequence-viewer/getPublicSequenceHashMatcher';

let instance: ShortCodeManager | null = null;
let _browseLoader: PublicSequencesLoader | null = null;

/**
 * Must be called once from di/index.ts after the browse container is built,
 * before any consumer calls getShortCodeManager().
 */
export function configureShortCodeManager(browseLoader: PublicSequencesLoader): void {
	_browseLoader = browseLoader;
}

export function getShortCodeManager(): ShortCodeManager {
	if (!browser) throw new Error('getShortCodeManager() is browser-only');
	if (!instance) {
		if (!_browseLoader) {
			throw new Error('getShortCodeManager(): call configureShortCodeManager() first');
		}
		instance = new ShortCodeManager(
			_browseLoader,
			getPublicSequenceHashMatcher(),
		);
	}
	return instance;
}
