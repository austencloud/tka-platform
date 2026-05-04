import { browser } from '$app/environment';
import { GenerationOrchestrator } from './services/implementations/GenerationOrchestrator';
import { BrowserVariationProvider } from './services/implementations/BrowserVariationProvider';
import { BuildResultTransformer } from './services/implementations/BuildResultTransformer';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';
import { reversalDetector } from '$lib/features/create/shared/services/reversal-detector';
import { getOrientationCycleDetector } from '$lib/features/create/generate/circular/getOrientationCycleDetector';
import { getSequenceMetadataManager } from './getSequenceMetadataManager';

let instance: GenerationOrchestrator | null = null;

export function getGenerationOrchestrator(): GenerationOrchestrator {
	if (!browser) throw new Error('getGenerationOrchestrator() is browser-only');
	if (!instance) {
		const metadataManager = getSequenceMetadataManager();
		instance = new GenerationOrchestrator(
			new BrowserVariationProvider(letterQueryHandler),
			new BuildResultTransformer(metadataManager, reversalDetector, getOrientationCycleDetector()),
			metadataManager
		);
	}
	return instance;
}
