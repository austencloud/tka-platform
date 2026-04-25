import { browser } from '$app/environment';
import type { ISequenceAnalyzer } from './services/contracts/ISequenceAnalyzer';
import { SequenceAnalyzer } from './services/implementations/SequenceAnalyzer';
import { betaDetector } from '$lib/shared/pictograph/prop/services/implementations/BetaDetector';

let instance: ISequenceAnalyzer | null = null;

export function getSequenceAnalyzer(): ISequenceAnalyzer {
	if (!browser) throw new Error('getSequenceAnalyzer() is browser-only');
	return instance ??= new SequenceAnalyzer(betaDetector);
}
