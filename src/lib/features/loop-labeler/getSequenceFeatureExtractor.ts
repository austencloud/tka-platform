import { browser } from '$app/environment';
import type { ISequenceFeatureExtractor } from './services/contracts/ISequenceFeatureExtractor';
import { SequenceFeatureExtractor } from './services/implementations/SequenceFeatureExtractor';
import { getSequenceAnalyzer } from '$lib/features/create/shared/getSequenceAnalyzer';

let instance: ISequenceFeatureExtractor | null = null;

export function getSequenceFeatureExtractor(): ISequenceFeatureExtractor {
	if (!browser) throw new Error('getSequenceFeatureExtractor() is browser-only');
	return instance ??= new SequenceFeatureExtractor(getSequenceAnalyzer());
}
