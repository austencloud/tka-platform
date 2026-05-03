import { browser } from '$app/environment';
import { StepPairAnalyzer } from './services/implementations/StepPairAnalyzer';

let instance: StepPairAnalyzer | null = null;

export function getStepPairAnalyzer(): StepPairAnalyzer {
	if (!browser) throw new Error('getStepPairAnalyzer() is browser-only');
	return instance ??= new StepPairAnalyzer();
}
