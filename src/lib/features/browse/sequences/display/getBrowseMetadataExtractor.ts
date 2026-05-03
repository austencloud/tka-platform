import { browser } from '$app/environment';
import { BrowseMetadataExtractor } from './services/implementations/BrowseMetadataExtractor';
import { getSequenceDifficultyCalculator } from './getSequenceDifficultyCalculator';

let instance: BrowseMetadataExtractor | null = null;

export function getBrowseMetadataExtractor(): BrowseMetadataExtractor {
	if (!browser) throw new Error('getBrowseMetadataExtractor() is browser-only');
	return instance ??= new BrowseMetadataExtractor(getSequenceDifficultyCalculator());
}
