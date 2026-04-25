import { browser } from '$app/environment';
import type { IStepSignatureGenerator } from './services/contracts/IBeatSignatureGenerator';
import { StepSignatureGenerator } from './services/implementations/BeatSignatureGenerator';
import { getMotionSignatureGenerator } from './getMotionSignatureGenerator';

let instance: IStepSignatureGenerator | null = null;

export function getStepSignatureGenerator(): IStepSignatureGenerator {
	if (!browser) throw new Error('getStepSignatureGenerator() is browser-only');
	return instance ??= new StepSignatureGenerator(getMotionSignatureGenerator());
}
