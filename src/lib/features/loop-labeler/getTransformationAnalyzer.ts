import { browser } from '$app/environment';
import type { ITransformationAnalyzer } from './services/contracts/ITransformationAnalyzer';
import { TransformationAnalyzer } from './services/implementations/TransformationAnalyzer';
import { getCandidateFormatter } from './getCandidateFormatter';

let instance: ITransformationAnalyzer | null = null;

export function getTransformationAnalyzer(): ITransformationAnalyzer {
	if (!browser) throw new Error('getTransformationAnalyzer() is browser-only');
	return instance ??= new TransformationAnalyzer(getCandidateFormatter());
}
