import { browser } from '$app/environment';
import { StepSignatureGenerator } from './services/implementations/StepSignatureGenerator';
import { getMotionSignatureGenerator } from './getMotionSignatureGenerator';

let instance: StepSignatureGenerator | null = null;

export function getStepSignatureGenerator(): StepSignatureGenerator {
	if (!browser) throw new Error('getStepSignatureGenerator() is browser-only');
	return instance ??= new StepSignatureGenerator(getMotionSignatureGenerator());
}
