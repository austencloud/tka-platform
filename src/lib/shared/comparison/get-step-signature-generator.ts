import { browser } from '$app/environment';
import { StepSignatureGenerator } from './services/step-signature-generator';
import { getMotionSignatureGenerator } from './get-motion-signature-generator';

let instance: StepSignatureGenerator | null = null;

export function getStepSignatureGenerator(): StepSignatureGenerator {
	if (!browser) throw new Error('getStepSignatureGenerator() is browser-only');
	return instance ??= new StepSignatureGenerator(getMotionSignatureGenerator());
}
