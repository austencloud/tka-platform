import { browser } from '$app/environment';
import type { IMotionSignatureGenerator } from './services/contracts/IMotionSignatureGenerator';
import { MotionSignatureGenerator } from './services/implementations/MotionSignatureGenerator';

let instance: IMotionSignatureGenerator | null = null;

export function getMotionSignatureGenerator(): IMotionSignatureGenerator {
	if (!browser) throw new Error('getMotionSignatureGenerator() is browser-only');
	return instance ??= new MotionSignatureGenerator();
}
