import { browser } from '$app/environment';
import type { IBrowseMetadataExtractor } from './services/contracts/IBrowseMetadataExtractor';
import { BrowseMetadataExtractor } from './services/implementations/BrowseMetadataExtractor';
import { getSequenceDifficultyCalculator } from './getSequenceDifficultyCalculator';

let instance: IBrowseMetadataExtractor | null = null;

export function getBrowseMetadataExtractor(): IBrowseMetadataExtractor {
	if (!browser) throw new Error('getBrowseMetadataExtractor() is browser-only');
	return instance ??= new BrowseMetadataExtractor(getSequenceDifficultyCalculator());
}
