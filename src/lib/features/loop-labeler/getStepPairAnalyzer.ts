import { browser } from '$app/environment';
import type { IStepPairAnalyzer } from './services/contracts/IStepPairAnalyzer';
import { StepPairAnalyzer } from './services/implementations/StepPairAnalyzer';

let instance: IStepPairAnalyzer | null = null;

export function getStepPairAnalyzer(): IStepPairAnalyzer {
	if (!browser) throw new Error('getStepPairAnalyzer() is browser-only');
	return instance ??= new StepPairAnalyzer();
}
