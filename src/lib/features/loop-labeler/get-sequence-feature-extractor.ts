import { browser } from '$app/environment';
import { SequenceFeatureExtractor } from './services/sequence-feature-extractor';
import { getSequenceAnalyzer } from '$lib/features/create/shared/get-sequence-analyzer';

let instance: SequenceFeatureExtractor | null = null;

export function getSequenceFeatureExtractor(): SequenceFeatureExtractor {
	if (!browser) throw new Error('getSequenceFeatureExtractor() is browser-only');
	return instance ??= new SequenceFeatureExtractor(getSequenceAnalyzer());
}
