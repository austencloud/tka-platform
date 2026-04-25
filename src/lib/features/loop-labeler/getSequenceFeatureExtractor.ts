import { browser } from '$app/environment';
import type { ISequenceFeatureExtractor } from './services/contracts/ISequenceFeatureExtractor';
import { SequenceFeatureExtractor } from './services/implementations/SequenceFeatureExtractor';
import { getCreateContainer } from '$lib/shared/di/containers/create-container';

let instance: ISequenceFeatureExtractor | null = null;

export function getSequenceFeatureExtractor(): ISequenceFeatureExtractor {
	if (!browser) throw new Error('getSequenceFeatureExtractor() is browser-only');
	return instance ??= new SequenceFeatureExtractor(getCreateContainer().items.sequenceAnalyzer);
}
